import { NextRequest, NextResponse } from 'next/server'
import { join } from 'path'

/**
 * POST /api/render-issue
 * Server-side: downloads the PDF, renders every page with @napi-rs/canvas + pdfjs-dist,
 * splits landscape spreads into L/R halves, uploads JPEGs to Supabase Storage,
 * and saves the slot-URL map in issues.page_images_json.
 *
 * Prerequisites (run once in Supabase SQL Editor):
 *   ALTER TABLE issues ADD COLUMN IF NOT EXISTS page_images_json jsonb;
 *   -- Create a public 'page-images' bucket (Storage → New bucket → Public)
 */

export const maxDuration = 60   // seconds (300 on Pro plan)
export const dynamic    = 'force-dynamic'

const RENDER_SCALE = 1.8        // higher = better quality, slower + more memory
const JPEG_QUALITY = 88         // 0-100

export async function POST(req: NextRequest) {
  try {
    // ── Auth ───────────────────────────────────────────────────────────────
    const auth = req.headers.get('authorization')
    if (!auth || auth !== process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { issueId } = body as { issueId?: string }
    if (!issueId) return NextResponse.json({ error: 'Missing issueId' }, { status: 400 })

    // ── Fetch issue ────────────────────────────────────────────────────────
    const { createServerClient } = await import('@/lib/supabase-server')
    const db = createServerClient()

    const { data: issue, error: dbErr } = await db
      .from('issues')
      .select('id, pdf_url, page_count')
      .eq('id', issueId)
      .single()

    if (dbErr || !issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
    }

    // ── Download PDF ───────────────────────────────────────────────────────
    const pdfRes = await fetch(issue.pdf_url, { cache: 'no-store' })
    if (!pdfRes.ok) throw new Error(`Failed to fetch PDF: ${pdfRes.status}`)
    const pdfBuffer = new Uint8Array(await pdfRes.arrayBuffer())

    // ── Init pdfjs ─────────────────────────────────────────────────────────
    // Import pdfjs-dist. In the serverless bundle, set workerSrc to the bundled
    // worker file. pdfjs-dist detects Node.js and uses worker_threads internally.
    const pdfjsLib = await import('pdfjs-dist')
    const workerPath = join(process.cwd(), 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs')
    ;(pdfjsLib as any).GlobalWorkerOptions.workerSrc = `file://${workerPath}`

    // ── Load PDF document ──────────────────────────────────────────────────
    const doc = await pdfjsLib.getDocument({
      data: pdfBuffer,
      isEvalSupported: false,
      useSystemFonts: true,
      disableRange: true,
      disableStream: true,
    }).promise

    // ── Detect spread format (same logic as PDFReader) ─────────────────────
    const p1  = await doc.getPage(1)
    const vp1 = p1.getViewport({ scale: 1 })

    let isSpreadPDF = false
    let isAllSpread = false
    let pageDimensions = { w: vp1.width, h: vp1.height }

    if (vp1.width > vp1.height * 1.1) {
      // All pages are landscape spreads
      pageDimensions = { w: vp1.width / 2, h: vp1.height }
      isSpreadPDF = true
      isAllSpread = true
    } else if (doc.numPages >= 2) {
      const p2  = await doc.getPage(2)
      const vp2 = p2.getViewport({ scale: 1 })
      isSpreadPDF = vp2.width > vp2.height * 1.1
    }

    // ── Ensure Storage bucket exists ───────────────────────────────────────
    await db.storage.createBucket('page-images', { public: true }).catch(() => {})

    // ── Render each page → upload JPEG ─────────────────────────────────────
    const { createCanvas } = await import('@napi-rs/canvas')
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const slots: Record<string, string> = {}

    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page     = await doc.getPage(pageNum)
      const viewport = page.getViewport({ scale: RENDER_SCALE })

      // Create canvas for this page
      const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height))
      const ctx    = canvas.getContext('2d')

      // Render PDF page onto canvas
      await page.render({
        canvasContext: ctx as unknown as CanvasRenderingContext2D,
        viewport,
        // v5 requires canvas param; cast our @napi-rs/canvas object
        canvas: canvas as unknown as HTMLCanvasElement,
      }).promise

      const isLandscape = isSpreadPDF && (isAllSpread || pageNum > 1)

      if (isLandscape) {
        // Split into LEFT and RIGHT halves
        const halfW = Math.round(canvas.width / 2)

        for (const side of ['L', 'R'] as const) {
          const half    = createCanvas(halfW, canvas.height)
          const halfCtx = half.getContext('2d')
          const sx      = side === 'L' ? 0 : halfW
          halfCtx.drawImage(canvas as unknown as any, sx, 0, halfW, canvas.height, 0, 0, halfW, canvas.height)

          const key    = `${pageNum}_${side}`
          const buffer = half.toBuffer('image/jpeg', JPEG_QUALITY)
          const path   = `${issueId}/${key}.jpg`

          const { error: uploadErr } = await db.storage
            .from('page-images')
            .upload(path, buffer, { contentType: 'image/jpeg', upsert: true })

          if (uploadErr) throw new Error(`Upload failed [${key}]: ${uploadErr.message}`)

          slots[key] = `${SUPABASE_URL}/storage/v1/object/public/page-images/${path}`
        }
      } else {
        const key    = String(pageNum)
        const buffer = canvas.toBuffer('image/jpeg', JPEG_QUALITY)
        const path   = `${issueId}/${key}.jpg`

        const { error: uploadErr } = await db.storage
          .from('page-images')
          .upload(path, buffer, { contentType: 'image/jpeg', upsert: true })

        if (uploadErr) throw new Error(`Upload failed [${key}]: ${uploadErr.message}`)

        slots[key] = `${SUPABASE_URL}/storage/v1/object/public/page-images/${path}`
      }
    }

    // ── Save to DB ─────────────────────────────────────────────────────────
    const pageImagesJson = {
      isSpreadPDF,
      isAllSpread,
      pageDimensions,
      totalPdfPages: doc.numPages,
      slots,
    }

    const { error: updateErr } = await db
      .from('issues')
      .update({ page_images_json: pageImagesJson })
      .eq('id', issueId)

    if (updateErr) {
      // Most likely cause: column doesn't exist yet
      if (updateErr.message?.includes('page_images_json')) {
        return NextResponse.json({
          error: 'DB column missing. Run in Supabase SQL Editor:\n' +
                 'ALTER TABLE issues ADD COLUMN IF NOT EXISTS page_images_json jsonb;',
        }, { status: 500 })
      }
      throw new Error(updateErr.message)
    }

    return NextResponse.json({ ok: true, slots: Object.keys(slots).length, isSpreadPDF, isAllSpread })

  } catch (err) {
    console.error('[render-issue]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
