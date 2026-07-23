/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/render-issue
 *
 * Cloudinary-based rendering: instead of rendering pages server-side with
 * @napi-rs/canvas (which has CMYK and image-transform bugs), this route
 * only reads PDF metadata (page count, spread layout) and constructs
 * Cloudinary fetch-transformation URLs for each page.
 *
 * Cloudinary renders the actual image on first access using Ghostscript/
 * LibVIPS, which handles CMYK, all transforms, and all color spaces correctly.
 * Results are cached on Cloudinary's CDN — subsequent loads are instant.
 *
 * Required env var: CLOUDINARY_CLOUD_NAME
 */

export const maxDuration = 60
export const dynamic    = 'force-dynamic'

/**
 * Builds a Cloudinary "fetch" URL that renders page `pageNum` of the PDF
 * at `pdfUrl` as a 1600-px-wide JPEG at 90% quality.
 */
function cloudinaryPageUrl(pdfUrl: string, pageNum: number): string {
  const cloud   = process.env.CLOUDINARY_CLOUD_NAME
  if (!cloud) throw new Error('CLOUDINARY_CLOUD_NAME env var is not set')
  const encoded = encodeURIComponent(pdfUrl)
  // pg_N  = page number (1-based)
  // w_1600 = max width 1600 px (Cloudinary maintains aspect ratio)
  // f_jpg  = convert to JPEG
  // q_90   = 90% JPEG quality
  return `https://res.cloudinary.com/${cloud}/image/fetch/pg_${pageNum},w_1600,f_jpg,q_90/${encoded}`
}

export async function POST(req: NextRequest) {
  let issueId: string | undefined
  let db: any

  try {
    const auth = req.headers.get('authorization')
    if (!auth || auth !== process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      return NextResponse.json({ error: 'CLOUDINARY_CLOUD_NAME is not configured in environment variables.' }, { status: 500 })
    }

    const body = await req.json()
    const { issueId: id, forceErrorPages = [] } = body as {
      issueId?: string
      forceErrorPages?: number[]
    }
    issueId = id
    if (!issueId) return NextResponse.json({ error: 'Missing issueId' }, { status: 400 })

    const { createServerClient } = await import('@/lib/supabase-server')
    db = createServerClient()

    const { data: issue, error: dbErr } = await db
      .from('issues')
      .select('id, pdf_url, page_count, page_images_json')
      .eq('id', issueId)
      .single()

    if (dbErr || !issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
    }

    await db.from('issues')
      .update({ images_status: 'processing', page_images_json: null })
      .eq('id', issueId)

    // ── PDF metadata only (no rendering) ──────────────────────────────────
    // We only need page count and spread detection — no canvas required.
    const pdfRes = await fetch(issue.pdf_url, { cache: 'no-store' })
    if (!pdfRes.ok) throw new Error(`Failed to fetch PDF: ${pdfRes.status}`)
    const pdfBuffer = new Uint8Array(await pdfRes.arrayBuffer())

    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.js')
    await import('pdfjs-dist/legacy/build/pdf.worker.js')

    const doc = await (pdfjsLib as any).getDocument({
      data: pdfBuffer,
      isEvalSupported:  false,
      disableRange:     true,
      disableStream:    true,
    }).promise

    const totalPdfPages = doc.numPages

    // Spread detection (landscape = double-page spread per PDF page)
    let isSpreadPDF    = false
    let isAllSpread    = false
    let pageDimensions = { w: 0, h: 0 }

    const p1  = await doc.getPage(1)
    const vp1 = p1.getViewport({ scale: 1 })
    pageDimensions = { w: vp1.width, h: vp1.height }

    if (vp1.width > vp1.height * 1.1) {
      // All pages are landscape spreads
      pageDimensions = { w: vp1.width / 2, h: vp1.height }
      isSpreadPDF    = true
      isAllSpread    = true
    } else if (totalPdfPages >= 2) {
      const p2  = await doc.getPage(2)
      const vp2 = p2.getViewport({ scale: 1 })
      isSpreadPDF = vp2.width > vp2.height * 1.1
    }

    // ── Build Cloudinary URL slots ────────────────────────────────────────
    // For both portrait and spread PDFs, slots are keyed by PDF page number.
    // Spread pages: slot["N"] = full landscape image (both pages in one image).
    // The reader handles the display — landscape images are shown full-width.
    const slots: Record<string, string> = {}
    const errorPages: number[] = []

    for (let pageNum = 1; pageNum <= totalPdfPages; pageNum++) {
      if ((forceErrorPages as number[]).includes(pageNum)) {
        errorPages.push(pageNum)
        continue
      }
      slots[String(pageNum)] = cloudinaryPageUrl(issue.pdf_url, pageNum)
    }

    const pageImagesJson = {
      isSpreadPDF,
      isAllSpread,
      pageDimensions,
      totalPdfPages,
      slots,
      errorPages,
      renderer: 'cloudinary',
    }

    const { error: updateErr } = await db.from('issues').update({
      page_images_json: pageImagesJson,
      images_status:    errorPages.length > 0 ? 'partial_error' : 'ready',
    }).eq('id', issueId)

    if (updateErr) throw new Error(updateErr.message)

    return NextResponse.json({
      ok:           true,
      totalPdfPages,
      isSpreadPDF,
      isAllSpread,
      slotsBuilt:   Object.keys(slots).length,
      errorPages,
      done:         true,
    })

  } catch (err: any) {
    console.error('[render-issue]', err?.message ?? err)
    if (db && issueId) {
      await db.from('issues')
        .update({ images_status: 'partial_error' })
        .eq('id', issueId)
        .catch(() => {})
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
