/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60
export const dynamic    = 'force-dynamic'

function cloudinaryPageUrl(pdfUrl: string, pageNum: number): string {
  const cloud   = process.env.CLOUDINARY_CLOUD_NAME
  if (!cloud) throw new Error('CLOUDINARY_CLOUD_NAME env var is not set')
  const encoded = encodeURIComponent(pdfUrl)
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

    // Spread detection
    let isSpreadPDF    = false
    let isAllSpread    = false
    let pageDimensions = { w: 0, h: 0 }

    const p1  = await doc.getPage(1)
    const vp1 = p1.getViewport({ scale: 1 })
    pageDimensions = { w: vp1.width, h: vp1.height }

    if (vp1.width > vp1.height * 1.1) {
      pageDimensions = { w: vp1.width / 2, h: vp1.height }
      isSpreadPDF    = true
      isAllSpread    = true
    } else if (totalPdfPages >= 2) {
      const p2  = await doc.getPage(2)
      const vp2 = p2.getViewport({ scale: 1 })
      isSpreadPDF = vp2.width > vp2.height * 1.1
    }

    // ── PDF size check — Cloudinary free plan cap is 10 MB ───────────────
    // If PDF exceeds the limit, skip Cloudinary and let the browser reader
    // render pages client-side with PDF.js (handles CMYK + all transforms).
    const MAX_CLOUDINARY_BYTES = 10 * 1024 * 1024

    if (pdfBuffer.length > MAX_CLOUDINARY_BYTES || !process.env.CLOUDINARY_CLOUD_NAME) {
      const pageImagesJson = {
        isSpreadPDF,
        isAllSpread,
        pageDimensions,
        totalPdfPages,
        slots:      {} as Record<string, string>,
        errorPages: [] as number[],
        renderer:   'pdfjs',
      }

      const { error: updateErr } = await db.from('issues').update({
        page_images_json: pageImagesJson,
        images_status:    'ready',
      }).eq('id', issueId)

      if (updateErr) throw new Error(updateErr.message)

      return NextResponse.json({
        ok:           true,
        totalPdfPages,
        isSpreadPDF,
        isAllSpread,
        slotsBuilt:   0,
        errorPages:   [],
        done:         true,
        renderer:     'pdfjs',
        note:         `PDF ${Math.round(pdfBuffer.length / 1024 / 1024)}MB — usando PDF.js en browser`,
      })
    }

    // ── Build Cloudinary URL slots (only for PDFs ≤ 10 MB) ───────────────
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
      renderer:     'cloudinary',
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
