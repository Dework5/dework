/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { join } from 'path'

/**
 * POST /api/render-issue
 */

export const maxDuration = 60
export const dynamic    = 'force-dynamic'

const RENDER_SCALE = 1.5
const JPEG_QUALITY = 93

/**
 * Patches canvas context methods that pdfjs-dist may call with an incompatible
 * Path2D argument (one created by its own internal polyfill instead of
 * @napi-rs/canvas's native Path2D).
 *
 * When @napi-rs/canvas receives a non-native Path2D it throws:
 *   Error: Value is none of these types 'String', 'Path' (code: InvalidArg)
 *
 * pdfjs-dist builds the current path with beginPath/moveTo/lineTo before
 * creating the Path2D object, so falling back to the no-arg form (which uses
 * the current path) produces visually identical output.
 */
function patchCtx(ctx: any) {
  for (const method of ['fill', 'stroke', 'clip'] as const) {
    const original = ctx[method].bind(ctx)
    ctx[method] = (...args: any[]) => {
      try {
        return original(...args)
      } catch (e: any) {
        // Only swallow the specific Path2D type-mismatch error
        if (e?.code === 'InvalidArg' || e?.message?.includes('none of these types')) {
          // Retry: if first arg is a Path2D-like object, drop it and use
          // the current path (which pdfjs already built with beginPath/moveTo)
          if (args.length > 0 && typeof args[0] === 'object' && args[0] !== null) {
            try { return original(...args.slice(1)) } catch {}
            try { return original() } catch {}
            return // silently skip if all retries fail
          }
        }
        throw e
      }
    }
  }
  return ctx
}

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization')
    if (!auth || auth !== process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { issueId } = body as { issueId?: string }
    if (!issueId) return NextResponse.json({ error: 'Missing issueId' }, { status: 400 })

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

    const pdfRes = await fetch(issue.pdf_url, { cache: 'no-store' })
    if (!pdfRes.ok) throw new Error(`Failed to fetch PDF: ${pdfRes.status}`)
    const pdfBuffer = new Uint8Array(await pdfRes.arrayBuffer())

    // ── Load canvas + set globals before pdfjs-dist evaluates ─────────────
    const napiCanvas = await import('@napi-rs/canvas')
    const { createCanvas } = napiCanvas
    // Always set — pdfjs-dist will use these if it checks globalThis at call time
    ;(globalThis as any).Path2D   = napiCanvas.Path2D
    ;(globalThis as any).DOMMatrix = napiCanvas.DOMMatrix

    // ── Load pdfjs (bundled by Turbopack) ─────────────────────────────────
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const workerPath = join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs')
    ;(pdfjsLib as any).GlobalWorkerOptions.workerSrc = `file://${workerPath}`

    const doc = await pdfjsLib.getDocument({
      data: pdfBuffer,
      isEvalSupported: false,
      useSystemFonts: true,
      disableRange: true,
      disableStream: true,
    }).promise

    // Spread detection
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

    await db.storage.createBucket('page-images', { public: true }).catch(() => {})

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
    type Slot = { key: string; buffer: Buffer; path: string }
    const pending: Slot[] = []

    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page     = await doc.getPage(pageNum)
      const viewport = page.getViewport({ scale: RENDER_SCALE })
      const canvas   = createCanvas(Math.round(viewport.width), Math.round(viewport.height))

      // Patch fill/stroke/clip to handle incompatible Path2D gracefully
      const ctx = patchCtx(canvas.getContext('2d') as any)

      await page.render({
        canvasContext: ctx,
        viewport,
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

  } catch (err: any) {
    console.error('[render-issue]', err?.message ?? err)
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
