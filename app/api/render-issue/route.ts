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
 * FIX 10 (CMYK root cause): automatic detection of CMYK-corrupted renders.
 * pdfjs-dist in Node.js cannot decode CMYK JPEGs correctly — it renders only
 * the top-left corner of the image, stretched to fill the canvas.
 * Detection: after rendering, if the page has embedded images and the four
 * quadrants look suspiciously similar (avgMAD < 15 and overall stdDev > 10),
 * the page is automatically marked as errorPage and skipped. The reader then
 * falls back to browser PDF.js which handles CMYK correctly.
 *
 * forceErrorPages: manual override to explicitly mark specific pages as errors.
 * autoFlipNeeded: only checks operator at index 0 (page-level CTM).
 */

export const maxDuration = 60
export const dynamic    = 'force-dynamic'

const RENDER_SCALE   = 2.0
const JPEG_QUALITY   = 90
const PAGES_PER_CALL = 3
const MIN_JPEG_BYTES = 20000

// Quadrant similarity thresholds for CMYK corner-stretch detection
const CMYK_MAX_QUADRANT_MAD = 15  // if all quadrants avg MAD < this → suspicious
const CMYK_MIN_STDDEV       = 10  // image must have some content (not blank)

/**
 * Detects the CMYK "corner-stretch" rendering artifact.
 * When pdfjs-dist in Node renders a CMYK JPEG incorrectly, it produces
 * only the top-left corner of the image scaled up to fill the canvas.
 * This makes all four quadrants look nearly identical (same stretched corner).
 * Returns true if the canvas looks like a corner-stretch artifact.
 */
function detectCMYKCorruption(canvas: any, createCanvas: (w: number, h: number) => any): boolean {
  try {
    const w = canvas.width, h = canvas.height
    const ss = 8 // each quadrant downscaled to 8×8
    const qW = Math.floor(w / 2), qH = Math.floor(h / 2)

    function sampleQ(sx: number, sy: number): number[] {
      const s = createCanvas(ss, ss)
      const sCtx = s.getContext('2d') as any
      sCtx.drawImage(canvas, sx, sy, qW, qH, 0, 0, ss, ss)
      return Array.from(sCtx.getImageData(0, 0, ss, ss).data as Uint8ClampedArray)
    }

    const q = [
      sampleQ(0,    0),
      sampleQ(qW,   0),
      sampleQ(0,    qH),
      sampleQ(qW,   qH),
    ]

    // Mean absolute difference between each pair of quadrants
    function mad(a: number[], b: number[]): number {
      let sum = 0
      for (let i = 0; i < a.length; i += 4) {
        sum += (Math.abs(a[i]-b[i]) + Math.abs(a[i+1]-b[i+1]) + Math.abs(a[i+2]-b[i+2])) / 3
      }
      return sum / (a.length / 4)
    }

    const pairs: [number[], number[]][] = [
      [q[0],q[1]], [q[0],q[2]], [q[0],q[3]],
      [q[1],q[2]], [q[1],q[3]], [q[2],q[3]],
    ]
    const avgMad = pairs.reduce((acc, [a, b]) => acc + mad(a, b), 0) / pairs.length

    // Overall pixel variance across all quadrant samples
    const all = [...q[0], ...q[1], ...q[2], ...q[3]]
    let mean = 0
    const nPx = all.length / 4
    for (let i = 0; i < all.length; i += 4) mean += (all[i] + all[i+1] + all[i+2]) / 3
    mean /= nPx
    let variance = 0
    for (let i = 0; i < all.length; i += 4) {
      const g = (all[i] + all[i+1] + all[i+2]) / 3
      variance += (g - mean) ** 2
    }
    const stdDev = Math.sqrt(variance / nPx)

    // Corner-stretch: quadrants very similar (low avgMad) AND image has real content (stdDev > floor)
    // Normal page: high avgMad (different parts of page look different)
    // Blank page: low stdDev → already caught by MIN_JPEG_BYTES check
    return avgMad < CMYK_MAX_QUADRANT_MAD && stdDev > CMYK_MIN_STDDEV
  } catch {
    return false // never flag on error
  }
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
    const {
      issueId: id,
      startPage = 1,
      endPage,
      forceFlipPages  = [],
      forceErrorPages = [],
    } = body as {
      issueId?: string
      startPage?: number
      endPage?: number
      forceFlipPages?: number[]
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

    const existing      = (issue.page_images_json as any) || {}
    const slots: Record<string, string> = startPage === 1 ? {} : { ...(existing.slots ?? {}) }
    const priorErrors: number[]         = startPage === 1 ? [] : ((existing.errorPages ?? []) as number[])
    const batchErrorPages: number[]     = []
    const pageRotations: Record<number, number> = {}

    // pdfjs-dist OPS constants
    const OPS            = (pdfjsLib as any).OPS ?? {}
    const TRANSFORM_OP   = OPS.transform          ?? 9
    const PAINT_JPEG_OP  = OPS.paintJpegXObject   ?? 82
    const PAINT_IMAGE_OP = OPS.paintImageXObject   ?? 83

    for (let pageNum = batchStart; pageNum <= batchEnd; pageNum++) {
      // Manual override: skip this page entirely, remove any existing slot
      if ((forceErrorPages as number[]).includes(pageNum)) {
        const isLandscape = isSpreadPDF && (isAllSpread || pageNum > 1)
        if (isLandscape) {
          await db.storage.from('page-images').remove([
            `${issueId}/${pageNum}_L.jpg`,
            `${issueId}/${pageNum}_R.jpg`,
          ]).catch(() => {})
          delete slots[`${pageNum}_L`]
          delete slots[`${pageNum}_R`]
        } else {
          await db.storage.from('page-images').remove([`${issueId}/${pageNum}.jpg`]).catch(() => {})
          delete slots[String(pageNum)]
        }
        batchErrorPages.push(pageNum)
        continue
      }

      try {
        const page            = await doc.getPage(pageNum)
        const naturalRotation = page.rotate || 0
        pageRotations[pageNum] = naturalRotation

        // ── Operator list: fetch BEFORE render (autoFlip detection + JPEG detection) ──
        let autoFlipNeeded    = false
        let hasEmbeddedImages = false
        try {
          const opList = await page.getOperatorList()

          // autoFlip: only check the very first op (page-level CTM), not later ops
          // which may be object-local transform matrices and cause false positives
          if (opList.fnArray[0] === TRANSFORM_OP) {
            const m = opList.argsArray[0] as number[]
            if (Array.isArray(m) && m[3] < 0) autoFlipNeeded = true
          }

          // CMYK detection: does this page have embedded raster images?
          hasEmbeddedImages = opList.fnArray.some(
            (op: number) => op === PAINT_JPEG_OP || op === PAINT_IMAGE_OP
          )
        } catch { /* ignore */ }

        // ── Render ──
        const viewport = page.getViewport({ scale: RENDER_SCALE, rotation: 0 })
        const canvas   = createCanvas(Math.round(viewport.width), Math.round(viewport.height))
        const ctx      = canvas.getContext('2d')

        await page.render({
          canvasContext: ctx as unknown as CanvasRenderingContext2D,
          viewport,
        }).promise

        // ── Natural rotation correction ──
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

        // ── CMYK corruption auto-detection ──
        // If the page has embedded raster images AND the render looks like a
        // corner-stretch artifact, mark it as an errorPage (browser will use PDF.js).
        if (hasEmbeddedImages) {
          const corrupted = detectCMYKCorruption(renderCanvas, createCanvas)
          if (corrupted) {
            console.warn(`[render-issue] page ${pageNum} CMYK-corrupted (corner-stretch detected) — auto errorPage`)
            const isLandscape = isSpreadPDF && (isAllSpread || pageNum > 1)
            if (isLandscape) {
              await db.storage.from('page-images').remove([
                `${issueId}/${pageNum}_L.jpg`,
                `${issueId}/${pageNum}_R.jpg`,
              ]).catch(() => {})
              delete slots[`${pageNum}_L`]
              delete slots[`${pageNum}_R`]
            } else {
              await db.storage.from('page-images').remove([`${issueId}/${pageNum}.jpg`]).catch(() => {})
              delete slots[String(pageNum)]
            }
            batchErrorPages.push(pageNum)
            continue
          }
        }

        // ── autoFlip (180° rotation for PDFs with negative Y-scale CTM) ──
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

        // ── Upload ──
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

            if (buf.length < MIN_JPEG_BYTES) {
              console.warn(`[render-issue] page ${pageNum}_${side} JPEG too small (${buf.length}B) — skipped`)
              batchErrorPages.push(pageNum)
              continue
            }

            const { error } = await db.storage.from('page-images').upload(path, buf, {
              contentType: 'image/jpeg', upsert: true, cacheControl: '31536000',
            })
            if (error) throw new Error(`Upload failed [${key}]: ${error.message}`)
            slots[key] = `${SUPABASE_URL}/storage/v1/object/public/page-images/${path}`
          }
        } else {
          const key  = String(pageNum)
          const path = `${issueId}/${key}.jpg`
          const buf  = renderCanvas.toBuffer('image/jpeg', JPEG_QUALITY)

          if (buf.length < MIN_JPEG_BYTES) {
            console.warn(`[render-issue] page ${pageNum} JPEG too small (${buf.length}B) — skipped`)
            batchErrorPages.push(pageNum)
            continue
          }

          const { error } = await db.storage.from('page-images').upload(path, buf, {
            contentType: 'image/jpeg', upsert: true, cacheControl: '31536000',
          })
          if (error) throw new Error(`Upload failed [${key}]: ${error.message}`)
          slots[key] = `${SUPABASE_URL}/storage/v1/object/public/page-images/${path}`
        }
      } catch (pageErr: any) {
        console.error(`[render-issue] page ${pageNum} failed:`, pageErr?.message ?? pageErr)
        batchErrorPages.push(pageNum)
      }
    }

    const done          = batchEnd >= totalPdfPages
    const nextStart     = done ? null : batchEnd + 1
    const allErrorPages = [...priorErrors, ...batchErrorPages]
    const pageImagesJson = {
      isSpreadPDF, isAllSpread, pageDimensions, totalPdfPages, slots, errorPages: allErrorPages,
    }

    const updatePayload: any = { page_images_json: pageImagesJson }
    if (done) {
      updatePayload.images_status = allErrorPages.length > 0 ? 'partial_error' : 'ready'
    }

    const { error: updateErr } = await db.from('issues').update(updatePayload).eq('id', issueId)

    if (updateErr) {
      if (updateErr.message?.includes('images_status')) {
        return NextResponse.json({
          error: "Run: ALTER TABLE issues ADD COLUMN IF NOT EXISTS images_status TEXT DEFAULT 'pending';",
        }, { status: 500 })
      }
      throw new Error(updateErr.message)
    }

    if (!done && nextStart) {
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : `http://localhost:${process.env.PORT || 3000}`
      fetch(`${baseUrl}/api/render-issue`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: process.env.NEXT_PUBLIC_ADMIN_PASSWORD || '' },
        body:    JSON.stringify({ issueId, startPage: nextStart, forceErrorPages }),
      }).catch(() => {})
    }

    return NextResponse.json({
      ok:            true,
      pagesRendered: batchEnd - batchStart + 1 - batchErrorPages.length,
      batchErrorPages,
      allErrorPages,
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
    if (db && issueId) {
      await db.from('issues').update({ images_status: 'partial_error' }).eq('id', issueId).catch(() => {})
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
