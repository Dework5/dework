/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { join } from 'path'

/**
 * POST /api/render-issue
 * Server-side: downloads the PDF, renders every page with @napi-rs/canvas + pdfjs-dist,
 * splits landscape spreads into L/R halves, uploads all JPEGs to Supabase Storage in
 * parallel, and saves the slot-URL map in issues.page_images_json.
 *
 * Prerequisites (run once in Supabase SQL Editor):
 *   ALTER TABLE issues ADD COLUMN IF NOT EXISTS page_images_json jsonb;
 *   -- Create a public 'page-images' bucket (Storage → New bucket → Public)
 */

export const maxDuration = 60   // seconds (Hobby max; Pro supports 300)
export const dynamic    = 'force-dynamic'

const RENDER_SCALE = 1.5   // 1.5× = ~892px wide for A4 — noticeably sharper for reading
const JPEG_QUALITY = 93    // 0-100

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

    // ── Init canvas first — @napi-rs/canvas also sets up DOMMatrix globally ──
    // pdfjs-dist/legacy requires DOMMatrix at init; @napi-rs/canvas provides it
    const { createCanvas, Path2D: NapiPath2D } = await import('@napi-rs/canvas')

    // Expose @napi-rs/canvas's Path2D globally so pdfjs-dist creates compatible
    // Path2D instances (its internal ones cause InvalidArg when passed to canvas ctx)
    if (typeof (globalThis as any).Path2D === 'undefined') {
      ;(globalThis as any).Path2D = NapiPath2D
    }

    // ── Init pdfjs (legacy build — Node.js compatible) ────────────────────
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const workerPath = join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs')
    ;(pdfjsLib as any).GlobalWorkerOptions.workerSrc = `file://${workerPath}`

    // ── Load PDF document ──────────────────────────────────────────────────
    const doc = await pdfjsLib.getDocument({
      data: pdfBuffer,
      isEvalSupported: false,
      useSystemFonts: true,
      disableRange: true,
      disableStream: true,
    }).promise

    // ── Detect spread format ───────────────────────────────────────────────
    const p1  = await doc.getPage(1)
    const vp1 = p1.getViewport({ scale: 1 })

    let isSpreadPDF = false
    let isAllSpread = false
    let pageDimensions = { w: vp1.width, h: vp1.height }

    if (vp1.width > vp1.height * 1.1) {
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

    // ── Phase 1: Render all pages sequentially (CPU-bound) ─────────────────
    // Collect { key, buffer, path } for every slot. Upload happens after.
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

    type Slot = { key: string; buffer: Buffer; path: string }
    const pending: Slot[] = []

    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page     = await doc.getPage(pageNum)
      const viewport = page.getViewport({ scale: RENDER_SCALE })
      const canvas   = createCanvas(Math.round(viewport.width), Math.round(viewport.height))
      const ctx      = canvas.getContext('2d')

      await page.render({
        canvasContext: ctx as unknown as CanvasRenderingContext2D,
        viewport,
        canvas: canvas as unknown as HTMLCanvasElement,
      }).promise

      const isLandscape = isSpreadPDF && (isAllSpread || pageNum > 1)

      if (isLandscape) {
        const halfW = Math.round(canvas.width / 2)
        for (const side of ['L', 'R'] as const) {
          const half    = createCanvas(halfW, canvas.height)
          const halfCtx = half.getContext('2d')
          const sx      = side === 'L' ? 0 : halfW
          halfCtx.drawImage(canvas as any, sx, 0, halfW, canvas.height, 0, 0, halfW, canvas.height)
          const key = `${pageNum}_${side}`
          pending.push({ key, buffer: half.toBuffer('image/jpeg', JPEG_QUALITY), path: `${issueId}/${key}.jpg` })
        }
      } else {
        const key = String(pageNum)
        pending.push({ key, buffer: canvas.toBuffer('image/jpeg', JPEG_QUALITY), path: `${issueId}/${key}.jpg` })
      }
    }

    // ── Phase 2: Upload all slots in parallel (I/O-bound) ─────────────────
    const slots: Record<string, string> = {}

    await Promise.all(
      pending.map(async ({ key, buffer, path }) => {
        const { error } = await db.storage
          .from('page-images')
          .upload(path, buffer, { contentType: 'image/jpeg', upsert: true })
        if (error) throw new Error(`Upload failed [${key}]: ${error.message}`)
        slots[key] = `${SUPABASE_URL}/storage/v1/object/public/page-images/${path}`
      })
    )

    // ── Save to DB ─────────────────────────────────────────────────────────
    const pageImagesJson = { isSpreadPDF, isAllSpread, pageDimensions, totalPdfPages: doc.numPages, slots }

    const { error: updateErr } = await db
      .from('issues')
      .update({ page_images_json: pageImagesJson })
      .eq('id', issueId)

    if (updateErr) {
      if (updateErr.message?.includes('page_images_json')) {
        return NextResponse.json({
          error: 'DB column missing. Run: ALTER TABLE issues ADD COLUMN IF NOT EXISTS page_images_json jsonb;',
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
