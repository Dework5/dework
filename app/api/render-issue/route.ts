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
 * CMYK detection: scans raw PDF bytes for CMYK JPEG (SOF marker Nf=4).
 * When found, pages that have embedded raster images are skipped (errorPage).
 * Browser PDF.js handles CMYK correctly; @napi-rs/canvas does not.
 *
 * forceErrorPages: manual override to explicitly skip specific pages.
 * forceFlipPages:  manual override to flip specific pages 180°.
 * autoFlipNeeded:  checks page-level CTM at operator index 0 (or 1 if 0 is q).
 */

export const maxDuration = 60
export const dynamic    = 'force-dynamic'

const RENDER_SCALE   = 2.0
const JPEG_QUALITY   = 90
const PAGES_PER_CALL = 3
const MIN_JPEG_BYTES = 20000

/**
 * Scans raw PDF bytes for any JPEG with CMYK color space (SOF marker Nf=4).
 * CMYK JPEGs use the DCTDecode filter and appear as raw JPEG bytes in the PDF.
 * Returns true if at least one CMYK JPEG is found anywhere in the PDF.
 */
function hasCMYKJpeg(data: Uint8Array): boolean {
  const len = data.length
  for (let i = 0; i < len - 3; i++) {
    // JPEG Start-of-Image: 0xFF 0xD8
    if (data[i] !== 0xFF || data[i + 1] !== 0xD8) continue
    // Scan forward for SOF marker (max 64 KB per JPEG header)
    let j = i + 2
    const end = Math.min(i + 65536, len - 4)
    while (j < end) {
      if (data[j] !== 0xFF) { j++; continue }
      const marker = data[j + 1]
      if (marker === 0xD9 || marker === 0xDA) break // EOI / SOS — done with this JPEG
      if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
        // SOF0/SOF1/SOF2: byte at +9 is Nf (number of color components)
        // 3 = RGB/YCbCr, 4 = CMYK
        if (j + 9 < len && data[j + 9] === 4) return true
        break // not CMYK, try next SOI
      }
      if (j + 3 >= len) break
      const segLen = (data[j + 2] << 8) | data[j + 3]
      if (segLen < 2) break
      j += 2 + segLen
    }
  }
  return false
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

    // ── CMYK detection: scan raw PDF bytes once ────────────────────────────
    // If the PDF contains any CMYK JPEG, pages with embedded images are
    // skipped and handed off to browser PDF.js (errorPages), which decodes
    // CMYK correctly unlike @napi-rs/canvas + pdfjs-dist in Node.js.
    const pdfHasCMYK = hasCMYKJpeg(pdfBuffer)
    if (pdfHasCMYK) {
      console.log('[render-issue] CMYK JPEG detected in PDF — pages with raster images will be errorPages')
    }

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
    const SAVE_OP        = OPS.save               ?? 26
    const PAINT_JPEG_OP  = OPS.paintJpegXObject   ?? 82
    const PAINT_IMAGE_OP = OPS.paintImageXObject   ?? 83

    // Helper: delete a page's slots from storage and the slots map
    const deleteSlot = async (pageNum: number) => {
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
    }

    for (let pageNum = batchStart; pageNum <= batchEnd; pageNum++) {
      // Manual override: skip this page entirely
      if ((forceErrorPages as number[]).includes(pageNum)) {
        await deleteSlot(pageNum)
        batchErrorPages.push(pageNum)
        continue
      }

      try {
        const page            = await doc.getPage(pageNum)
        const naturalRotation = page.rotate || 0
        pageRotations[pageNum] = naturalRotation

        // ── Operator list analysis ────────────────────────────────────────
        let autoFlipNeeded    = false
        let hasEmbeddedImages = false
        try {
          const opList = await page.getOperatorList()

          // autoFlip: look for page-level CTM with m[3] < 0.
          // Check index 0; if that's a save (q), also check index 1.
          // Stop if the cm is immediately followed by a paint op (image-local transform).
          const cmIdx = opList.fnArray[0] === TRANSFORM_OP ? 0
                      : opList.fnArray[0] === SAVE_OP && opList.fnArray[1] === TRANSFORM_OP ? 1
                      : -1
          if (cmIdx >= 0) {
            const m    = opList.argsArray[cmIdx] as number[]
            const next = opList.fnArray[cmIdx + 1]
            // Only treat as page-level flip if NOT immediately followed by a paint op
            // (a cm right before Do is an image-placement transform, not a page flip)
            if (Array.isArray(m) && m[3] < 0 && next !== PAINT_JPEG_OP && next !== PAINT_IMAGE_OP) {
              autoFlipNeeded = true
            }
          }

          // CMYK gate: check whether this page has embedded raster images
          hasEmbeddedImages = opList.fnArray.some(
            (op: number) => op === PAINT_JPEG_OP || op === PAINT_IMAGE_OP
          )
        } catch { /* ignore */ }

        // ── CMYK auto-skip ────────────────────────────────────────────────
        // If the PDF contains CMYK JPEGs AND this page has embedded images,
        // skip server-side render — browser PDF.js handles CMYK correctly.
        if (pdfHasCMYK && hasEmbeddedImages) {
          console.warn(`[render-issue] page ${pageNum} skipped (CMYK PDF + raster images) — browser fallback`)
          await deleteSlot(pageNum)
          batchErrorPages.push(pageNum)
          continue
        }

        // ── Render ───────────────────────────────────────────────────────
        const viewport = page.getViewport({ scale: RENDER_SCALE, rotation: 0 })
        const canvas   = createCanvas(Math.round(viewport.width), Math.round(viewport.height))
        const ctx      = canvas.getContext('2d')

        await page.render({
          canvasContext: ctx as unknown as CanvasRenderingContext2D,
          viewport,
        }).promise

        // ── Natural rotation correction ───────────────────────────────────
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

        // ── 180° flip correction ─────────────────────────────────────────
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

        // ── Upload ────────────────────────────────────────────────────────
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
        body:    JSON.stringify({ issueId, startPage: nextStart, forceErrorPages, forceFlipPages }),
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
      pdfHasCMYK,
    })

  } catch (err: any) {
    console.error('[render-issue]', err?.message ?? err)
    if (db && issueId) {
      await db.from('issues').update({ images_status: 'partial_error' }).eq('id', issueId).catch(() => {})
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
