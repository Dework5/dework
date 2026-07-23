/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/render-issue
 * Renders PDF pages server-side with @napi-rs/canvas + pdfjs-dist v3.
 *
 * Batches of 3 pages to stay within Vercel Hobby's 10s function limit.
 * Self-chains: at the end of each batch, fires the next one automatically.
 * Status updates: pending → processing → ready (or partial_error on failure).
 *
 * FIX 10: per-page try-catch + buffer-size guard + tighter autoFlip detection.
 * autoFlipNeeded now only checks operator index 0 (page-level CTM) to avoid
 * false-positives triggered by object-local transform matrices on complex pages.
 */

export const maxDuration = 60
export const dynamic    = 'force-dynamic'

const RENDER_SCALE   = 2.0   // 2× for sharp text on HiDPI screens
const JPEG_QUALITY   = 90
const PAGES_PER_CALL = 3     // 3 pages keeps each invocation safely under 10s on Hobby
const MIN_JPEG_BYTES = 20000 // pages smaller than this are almost certainly blank/broken

export async function POST(req: NextRequest) {
  let issueId: string | undefined
  let db: any

  try {
    const auth = req.headers.get('authorization')
    if (!auth || auth !== process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { issueId: id, startPage = 1, endPage, forceFlipPages = [] } = body as {
      issueId?: string
      startPage?: number
      endPage?: number
      forceFlipPages?: number[]
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

    // Mark as processing on first batch
    if (startPage === 1) {
      await db.from('issues').update({ images_status: 'processing', page_images_json: null }).eq('id', issueId)
    }

    const pdfRes = await fetch(issue.pdf_url, { cache: 'no-store' })
    if (!pdfRes.ok) throw new Error(`Failed to fetch PDF: ${pdfRes.status}`)
    const pdfBuffer = new Uint8Array(await pdfRes.arrayBuffer())

    const napiCanvas = await import('@napi-rs/canvas')
    const { createCanvas } = napiCanvas

    if (napiCanvas.DOMMatrix && !(globalThis as any).DOMMatrix) {
      ;(globalThis as any).DOMMatrix = napiCanvas.DOMMatrix
    }
    if (napiCanvas.Path2D && !(globalThis as any).Path2D) {
      ;(globalThis as any).Path2D = napiCanvas.Path2D
    }

    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.js')
    await import('pdfjs-dist/legacy/build/pdf.worker.js')

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

    // Spread detection
    let isSpreadPDF    = false
    let isAllSpread    = false
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

    const batchStart = Math.max(1, startPage)
    const batchEnd   = Math.min(
      endPage ?? totalPdfPages,
      batchStart + PAGES_PER_CALL - 1,
      totalPdfPages
    )

    await db.storage.createBucket('page-images', { public: true }).catch(() => {})

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

    // Merge with existing slots and error pages from prior batches
    const existing        = (issue.page_images_json as any) || {}
    const slots: Record<string, string> = startPage === 1 ? {} : { ...(existing.slots ?? {}) }
    const priorErrors: number[]         = startPage === 1 ? [] : ((existing.errorPages ?? []) as number[])
    const batchErrorPages: number[]     = []
    const pageRotations: Record<number, number> = {}

    for (let pageNum = batchStart; pageNum <= batchEnd; pageNum++) {
      try {
        const page            = await doc.getPage(pageNum)
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
          const rRad   = (naturalRotation * Math.PI) / 180
          const absSin = Math.abs(Math.round(Math.sin(rRad)))
          const absCos = Math.abs(Math.round(Math.cos(rRad)))
          const rotW   = canvas.width * absCos + canvas.height * absSin
          const rotH   = canvas.width * absSin + canvas.height * absCos
          renderCanvas  = createCanvas(rotW, rotH)
          const rCtx   = renderCanvas.getContext('2d')
          rCtx.translate(rotW / 2, rotH / 2)
          rCtx.rotate(rRad)
          rCtx.drawImage(canvas as any, -canvas.width / 2, -canvas.height / 2)
        }

        // autoFlipNeeded: only check operator at index 0 (page-level CTM).
        // Checking further into the list risks false-positives from object-local
        // transform matrices (e.g. a large embedded image with m[3]<0 for its own
        // coordinate system), which caused page 12-style cropping bugs.
        let autoFlipNeeded = false
        try {
          const opList     = await page.getOperatorList()
          const TRANSFORM_OP = (pdfjsLib as any).OPS?.transform ?? 9
          if (opList.fnArray[0] === TRANSFORM_OP) {
            const m = opList.argsArray[0] as number[]
            if (Array.isArray(m) && m[3] < 0) autoFlipNeeded = true
          }
        } catch { /* ignore */ }

        if (autoFlipNeeded || (forceFlipPages as number[]).includes(pageNum)) {
          const srcCtx  = renderCanvas.getContext('2d') as any
          const imgData = srcCtx.getImageData(0, 0, renderCanvas.width, renderCanvas.height)
          const flipped = createCanvas(renderCanvas.width, renderCanvas.height)
          const fCtx    = flipped.getContext('2d') as any
          const dst     = fCtx.createImageData(renderCanvas.width, renderCanvas.height)
          const { data, width, height } = imgData
          for (let row = 0; row < height; row++) {
            for (let col = 0; col < width; col++) {
              const s = (row * width + col) * 4
              const d = ((height - 1 - row) * width + (width - 1 - col)) * 4
              dst.data[d]     = data[s]
              dst.data[d + 1] = data[s + 1]
              dst.data[d + 2] = data[s + 2]
              dst.data[d + 3] = data[s + 3]
            }
          }
          fCtx.putImageData(dst, 0, 0)
          renderCanvas = flipped
        }

        const isPageLandscape = isSpreadPDF && (isAllSpread || pageNum > 1)

        if (isPageLandscape) {
          const halfW = Math.round(renderCanvas.width / 2)
          for (const side of ['L', 'R'] as const) {
            const half    = createCanvas(halfW, renderCanvas.height)
            const halfCtx = half.getContext('2d')
            const sx      = side === 'L' ? 0 : halfW
            halfCtx.drawImage(renderCanvas as any, sx, 0, halfW, renderCanvas.height, 0, 0, halfW, renderCanvas.height)
            const key  = `${pageNum}_${side}`
            const path = `${issueId}/${key}.jpg`
            const buf  = half.toBuffer('image/jpeg', JPEG_QUALITY)

            // Sanity check: a half-page spread at 2× should be substantial
            if (buf.length < MIN_JPEG_BYTES) {
              console.warn(`[render-issue] page ${pageNum}_${side} JPEG too small (${buf.length}B) — skipped`)
              batchErrorPages.push(pageNum)
              continue
            }

            const { error } = await db.storage.from('page-images').upload(path, buf, { contentType: 'image/jpeg', upsert: true, cacheControl: '31536000' })
            if (error) throw new Error(`Upload failed [${key}]: ${error.message}`)
            slots[key] = `${SUPABASE_URL}/storage/v1/object/public/page-images/${path}`
          }
        } else {
          const key  = String(pageNum)
          const path = `${issueId}/${key}.jpg`
          const buf  = renderCanvas.toBuffer('image/jpeg', JPEG_QUALITY)

          // Sanity check: a full portrait page at 2× should be at least 20KB
          if (buf.length < MIN_JPEG_BYTES) {
            console.warn(`[render-issue] page ${pageNum} JPEG too small (${buf.length}B) — skipped`)
            batchErrorPages.push(pageNum)
            continue
          }

          const { error } = await db.storage.from('page-images').upload(path, buf, { contentType: 'image/jpeg', upsert: true, cacheControl: '31536000' })
          if (error) throw new Error(`Upload failed [${key}]: ${error.message}`)
          slots[key] = `${SUPABASE_URL}/storage/v1/object/public/page-images/${path}`
        }
      } catch (pageErr: any) {
        // Per-page error: log it, mark the page, and continue with the rest of the batch
        console.error(`[render-issue] page ${pageNum} failed:`, pageErr?.message ?? pageErr)
        batchErrorPages.push(pageNum)
      }
    }

    const done           = batchEnd >= totalPdfPages
    const nextStart      = done ? null : batchEnd + 1
    const allErrorPages  = [...priorErrors, ...batchErrorPages]
    const pageImagesJson = { isSpreadPDF, isAllSpread, pageDimensions, totalPdfPages, slots, errorPages: allErrorPages }

    const updatePayload: any = { page_images_json: pageImagesJson }
    if (done) {
      // Mark partial_error if any page failed; otherwise ready
      updatePayload.images_status = allErrorPages.length > 0 ? 'partial_error' : 'ready'
    }

    const { error: updateErr } = await db.from('issues').update(updatePayload).eq('id', issueId)

    if (updateErr) {
      if (updateErr.message?.includes('images_status')) {
        return NextResponse.json({ error: 'Run: ALTER TABLE issues ADD COLUMN IF NOT EXISTS images_status TEXT DEFAULT \'pending\';' }, { status: 500 })
      }
      throw new Error(updateErr.message)
    }

    // Self-chain: fire next batch before returning so the Lambda invocation starts immediately
    if (!done && nextStart) {
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : `http://localhost:${process.env.PORT || 3000}`
      fetch(`${baseUrl}/api/render-issue`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': process.env.NEXT_PUBLIC_ADMIN_PASSWORD || '' },
        body:    JSON.stringify({ issueId, startPage: nextStart }),
      }).catch(() => {})
    }

    return NextResponse.json({
      ok:              true,
      pagesRendered:   batchEnd - batchStart + 1 - batchErrorPages.length,
      batchErrorPages,
      allErrorPages,
      batchStart,
      batchEnd,
      totalPdfPages,
      nextStartPage:   nextStart,
      done,
      isSpreadPDF,
      isAllSpread,
      pageRotations,
    })

  } catch (err: any) {
    console.error('[render-issue]', err?.message ?? err)
    if (db && issueId) {
      await db.from('issues').update({ images_status: 'partial_error' }).eq('id', issueId).catch(() => {})
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
