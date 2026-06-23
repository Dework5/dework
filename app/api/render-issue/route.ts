/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/render-issue
 * Renders PDF pages server-side with @napi-rs/canvas + pdfjs-dist v3.
 *
 * Accepts { issueId, startPage?, endPage? } — renders at most PAGES_PER_CALL
 * pages per invocation. The admin client calls this in a loop until all pages
 * are done, advancing startPage each time.
 */

export const maxDuration = 60
export const dynamic    = 'force-dynamic'

const RENDER_SCALE    = 1.5
const JPEG_QUALITY    = 93
const PAGES_PER_CALL  = 8    // max pages per Lambda invocation (keeps each batch under 40s → safe on 60s limit)

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization')
    if (!auth || auth !== process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { issueId, startPage = 1, endPage, forceFlipPages = [] } = body as {
      issueId?: string
      startPage?: number
      endPage?: number
      forceFlipPages?: number[]
    }
    if (!issueId) return NextResponse.json({ error: 'Missing issueId' }, { status: 400 })

    const { createServerClient } = await import('@/lib/supabase-server')
    const db = createServerClient()

    const { data: issue, error: dbErr } = await db
      .from('issues')
      .select('id, pdf_url, page_count, page_images_json')
      .eq('id', issueId)
      .single()

    if (dbErr || !issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
    }

    const pdfRes = await fetch(issue.pdf_url, { cache: 'no-store' })
    if (!pdfRes.ok) throw new Error(`Failed to fetch PDF: ${pdfRes.status}`)
    const pdfBuffer = new Uint8Array(await pdfRes.arrayBuffer())

    // ── @napi-rs/canvas: external native binary ───────────────────────────
    const napiCanvas = await import('@napi-rs/canvas')
    const { createCanvas } = napiCanvas

    // Pre-set DOMMatrix + Path2D so pdfjs skips its require('canvas') polyfills
    if (napiCanvas.DOMMatrix && !(globalThis as any).DOMMatrix) {
      ;(globalThis as any).DOMMatrix = napiCanvas.DOMMatrix
    }
    if (napiCanvas.Path2D && !(globalThis as any).Path2D) {
      ;(globalThis as any).Path2D = napiCanvas.Path2D
    }

    // ── pdfjs-dist v3 CJS (both external) ────────────────────────────────
    // Loading pdf.worker.js registers WorkerMessageHandler on globalThis.pdfjsWorker
    // so the fake worker (in-process) resolves immediately without workerSrc.
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.js')
    await import('pdfjs-dist/legacy/build/pdf.worker.js')

    // Custom CanvasFactory — prevents pdfjs calling require('canvas') internally
    class NapiCanvasFactory {
      create(width: number, height: number) {
        const canvas = createCanvas(width, height)
        return { canvas, context: canvas.getContext('2d') }
      }
      reset(cc: any, width: number, height: number) {
        if (cc.canvas) { cc.canvas.width = width; cc.canvas.height = height }
      }
      destroy(cc: any) {
        if (cc.canvas) { cc.canvas.width = 0; cc.canvas.height = 0; delete cc.canvas; delete cc.context }
      }
    }

    const doc = await (pdfjsLib as any).getDocument({
      data: pdfBuffer,
      canvasFactory: new NapiCanvasFactory(),
      isEvalSupported: false,
      useSystemFonts: true,
      disableRange: true,
      disableStream: true,
    }).promise

    const totalPdfPages = doc.numPages

    // Spread detection (only on first batch so we have the metadata)
    let isSpreadPDF   = false
    let isAllSpread   = false
    let pageDimensions = { w: 0, h: 0 }

    const p1  = await doc.getPage(1)
    const vp1 = p1.getViewport({ scale: 1 })
    pageDimensions = { w: vp1.width, h: vp1.height }

    if (vp1.width > vp1.height * 1.1) {
      pageDimensions = { w: vp1.width / 2, h: vp1.height }
      isSpreadPDF = true
      isAllSpread = true
    } else if (totalPdfPages >= 2) {
      const p2  = await doc.getPage(2)
      const vp2 = p2.getViewport({ scale: 1 })
      isSpreadPDF = vp2.width > vp2.height * 1.1
    }

    // Resolve page range for this batch
    const batchStart = Math.max(1, startPage)
    const batchEnd   = Math.min(
      endPage ?? totalPdfPages,
      batchStart + PAGES_PER_CALL - 1,
      totalPdfPages
    )

    await db.storage.createBucket('page-images', { public: true }).catch(() => {})

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

    // Merge with existing slots if this is a continuation batch
    const existing = (issue.page_images_json as any) || {}
    const slots: Record<string, string> = { ...(existing.slots ?? {}) }
  const pageRotations: Record<number,number> = {}

    // Render + upload each page immediately (no accumulation in memory)
    for (let pageNum = batchStart; pageNum <= batchEnd; pageNum++) {
      const page     = await doc.getPage(pageNum)
      const naturalRotation = page.rotate || 0
      pageRotations[pageNum] = naturalRotation
      const viewport = page.getViewport({ scale: RENDER_SCALE, rotation: 0 })
      const canvas   = createCanvas(Math.round(viewport.width), Math.round(viewport.height))
      const ctx      = canvas.getContext('2d')

      await page.render({
        canvasContext: ctx as unknown as CanvasRenderingContext2D,
        viewport,
      }).promise

      let renderCanvas = canvas
      if (naturalRotation !== 0) {
        const rRad = (naturalRotation * Math.PI) / 180
        const absSin = Math.abs(Math.round(Math.sin(rRad)))
        const absCos = Math.abs(Math.round(Math.cos(rRad)))
        const rotW = canvas.width * absCos + canvas.height * absSin
        const rotH = canvas.width * absSin + canvas.height * absCos
        renderCanvas = createCanvas(rotW, rotH)
        const rCtx = renderCanvas.getContext('2d')
        rCtx.translate(rotW / 2, rotH / 2)
        rCtx.rotate(rRad)
        rCtx.drawImage(canvas as any, -canvas.width / 2, -canvas.height / 2)
      }

      // Auto-detect pages with y-flip in content stream that render inverted in napi-rs.
      // Some PDFs embed a negative-y transform (e.g. 1 0 0 -1 0 h cm) in the content stream
      // for top-left-origin coordinates. Chrome handles this fine; napi-rs renders them inverted.
      let autoFlipNeeded = false
      try {
        const opList = await page.getOperatorList()
        const TRANSFORM_OP = (pdfjsLib as any).OPS?.transform ?? 9
        for (let k = 0; k < Math.min(10, opList.fnArray.length); k++) {
          if (opList.fnArray[k] === TRANSFORM_OP) {
            const m = opList.argsArray[k] as number[]
            if (Array.isArray(m) && m[3] < 0) autoFlipNeeded = true
            break
          }
        }
      } catch { /* ignore */ }

      if (autoFlipNeeded || (forceFlipPages as number[]).includes(pageNum)) {
        const flipped = createCanvas(renderCanvas.width, renderCanvas.height)
        const fCtx = flipped.getContext('2d')
        fCtx.translate(renderCanvas.width, renderCanvas.height)
        fCtx.rotate(Math.PI)
        fCtx.drawImage(renderCanvas as any, 0, 0)
        renderCanvas = flipped
      }

      const isLandscape = isSpreadPDF && (isAllSpread || pageNum > 1)

      if (isLandscape) {
        const halfW = Math.round(renderCanvas.width / 2)
        for (const side of ['L', 'R'] as const) {
          const half    = createCanvas(halfW, canvas.height)
          const halfCtx = half.getContext('2d')
          const sx      = side === 'L' ? 0 : halfW
          halfCtx.drawImage(renderCanvas as any, sx, 0, halfW, renderCanvas.height, 0, 0, halfW, renderCanvas.height)
          const key  = `${pageNum}_${side}`
          const path = `${issueId}/${key}.jpg`
          const buf  = half.toBuffer('image/jpeg', JPEG_QUALITY)
          const { error } = await db.storage
            .from('page-images')
            .upload(path, buf, { contentType: 'image/jpeg', upsert: true })
          if (error) throw new Error(`Upload failed [${key}]: ${error.message}`)
          slots[key] = `${SUPABASE_URL}/storage/v1/object/public/page-images/${path}`
        }
      } else {
        const key  = String(pageNum)
        const path = `${issueId}/${key}.jpg`
        const buf  = renderCanvas.toBuffer('image/jpeg', JPEG_QUALITY)
        const { error } = await db.storage
          .from('page-images')
          .upload(path, buf, { contentType: 'image/jpeg', upsert: true })
        if (error) throw new Error(`Upload failed [${key}]: ${error.message}`)
        slots[key] = `${SUPABASE_URL}/storage/v1/object/public/page-images/${path}`
      }
    }

    const done        = batchEnd >= totalPdfPages
    const nextStart   = done ? null : batchEnd + 1
    const pageImagesJson = { isSpreadPDF, isAllSpread, pageDimensions, totalPdfPages, slots }

    // Always persist current slots so partial progress is saved
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

    return NextResponse.json({
      ok:           true,
      pagesRendered: batchEnd - batchStart + 1,
      batchStart,
      batchEnd,
      totalPdfPages,
      nextStartPage: nextStart,
      done,
      isSpreadPDF,
      isAllSpread,
      pageRotations,
    })

  } catch (err: any) {
    console.error('[render-issue]', err?.message ?? err)
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
