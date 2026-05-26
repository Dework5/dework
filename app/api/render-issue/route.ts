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

    // ── Step 1: Load @napi-rs/canvas and set globals BEFORE pdfjs loads ───
    const napiCanvas = await import('@napi-rs/canvas')
    const { createCanvas } = napiCanvas

    // Always overwrite — ensures pdfjs-dist (external too) sees these when
    // its module initialises on this first import() call below
    ;(globalThis as any).Path2D   = napiCanvas.Path2D
    ;(globalThis as any).DOMMatrix = napiCanvas.DOMMatrix

    console.log('[render-issue] Path2D type:', typeof (globalThis as any).Path2D)
    console.log('[render-issue] Path2D constructor:', (globalThis as any).Path2D?.name)

    // ── Step 2: Load pdfjs (external → inits NOW, after globals are set) ──
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const workerPath = join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs')
    ;(pdfjsLib as any).GlobalWorkerOptions.workerSrc = `file://${workerPath}`

    // ── Node canvas factory — pdfjs-dist v5 requires a CLASS (constructor) ──
    class NodeCanvasFactory {
      create(w: number, h: number) {
        const c = createCanvas(Math.ceil(w), Math.ceil(h))
        return { canvas: c, context: c.getContext('2d') }
      }
      reset(cc: any, w: number, h: number) {
        cc.canvas.width  = Math.ceil(w)
        cc.canvas.height = Math.ceil(h)
      }
      destroy(cc: any) {
        cc.canvas.width = 0
        cc.canvas.height = 0
      }
    }

    const doc = await pdfjsLib.getDocument({
      data: pdfBuffer,
      CanvasFactory: NodeCanvasFactory,
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
      const rawCtx   = canvas.getContext('2d') as any

      // ── Diagnostic proxy: wraps every ctx call and reports arg types on error
      // This lets us see EXACTLY which method fails and what type was passed.
      const ctx = new Proxy(rawCtx, {
        get(target, prop) {
          const val = Reflect.get(target, prop)
          if (typeof val !== 'function') return val
          return function (...args: unknown[]) {
            try {
              return (val as Function).apply(target, args)
            } catch (e: any) {
              const argInfo = args.map(a => {
                if (a === null)      return 'null'
                if (a === undefined) return 'undefined'
                return `${typeof a}<${(a as any)?.constructor?.name ?? '?'}>`
              }).join(', ')
              throw new Error(
                `ctx.${String(prop)}(${argInfo}) FAILED: ${e?.message ?? e}`
              )
            }
          }
        },
      })

      await page.render({
        canvasContext: ctx,
        viewport,
        // NOTE: no 'canvas' param — not an official pdfjs-dist v5 render param
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
    console.error('[render-issue] ERROR:', err?.message ?? err)
    // Return full message (not truncated) so admin UI shows exactly what failed
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
