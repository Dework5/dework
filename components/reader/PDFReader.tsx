'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import * as pdfjsLib from 'pdfjs-dist'
import type { PreRenderedImages } from '@/lib/types'

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@' + pdfjsLib.version + '/build/pdf.worker.min.js'

interface PDFReaderProps {
  pdfUrl: string
  issueId?: string
  totalPages?: number
  coverUrl?: string
  backUrl?: string
  downloadUrl?: string
  publicationName?: string
  issueTitle?: string
  preRendered?: PreRenderedImages | null
}

type RenderTaskLike = { cancel: () => void }

export function PDFReader({
  pdfUrl, issueId, totalPages,
  backUrl, publicationName, issueTitle,
}: PDFReaderProps) {
  const leftCanvasRef = useRef<HTMLCanvasElement>(null)
  const rightCanvasRef = useRef<HTMLCanvasElement>(null)
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [numPages, setNumPages] = useState(totalPages || 0)
  const [isMobile, setIsMobile] = useState(false)
  const [showDouble, setShowDouble] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isChanging, setIsChanging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const leftTaskRef = useRef<{ current: RenderTaskLike | null }>({ current: null })
  const rightTaskRef = useRef<{ current: RenderTaskLike | null }>({ current: null })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (!issueId) return
    try {
      const k = 'dw_sid'
      let sid = sessionStorage.getItem(k)
      if (!sid) { sid = crypto.randomUUID(); sessionStorage.setItem(k, sid) }
      fetch('/api/track-view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId, sessionId: sid }),
      }).catch(() => {})
    } catch (_) {}
  }, [issueId])

  useEffect(() => {
    setIsLoading(true)
    setError(null)
    const task = pdfjsLib.getDocument({
      url: pdfUrl,
      cMapUrl: '//cdnjs.cloudflare.com/ajax/libs/pdf.js/' + pdfjsLib.version + '/cmaps/',
      cMapPacked: true,
    })
    task.promise
      .then(doc => { setPdf(doc); setNumPages(doc.numPages); setIsLoading(false) })
      .catch(() => { setError('No se pudo cargar la revista.'); setIsLoading(false) })
    return () => { task.destroy().catch(() => {}) }
  }, [pdfUrl])

  const renderToCanvas = useCallback(async (
    pageNum: number,
    canvas: HTMLCanvasElement,
    taskRef: { current: RenderTaskLike | null },
    maxW: number,
    maxH: number
  ) => {
    if (!pdf || !canvas) return
    if (taskRef.current) { taskRef.current.cancel(); taskRef.current = null }
    try {
      const page = await pdf.getPage(pageNum)
      const base = page.getViewport({ scale: 1 })
      const scale = Math.min(maxW / base.width, maxH / base.height)
      const vp = page.getViewport({ scale })
      canvas.width = Math.floor(vp.width)
      canvas.height = Math.floor(vp.height)
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const t = page.render({ canvasContext: ctx, viewport: vp })
      taskRef.current = t
      await t.promise
    } catch (err: unknown) {
      if ((err as { name?: string })?.name !== 'RenderingCancelledException') console.error(err)
    }
  }, [pdf])

  useEffect(() => {
    if (!pdf) return
    const double = !isMobile || showDouble
    const availH = window.innerHeight - 44 - 40 - 48
    const maxW = double ? Math.min((window.innerWidth - 16) / 2, 580) : Math.min(window.innerWidth - 24, 760)
    if (leftCanvasRef.current) {
      renderToCanvas(currentPage, leftCanvasRef.current, leftTaskRef.current, maxW, availH)
    }
    if (double && currentPage + 1 <= numPages && rightCanvasRef.current) {
      renderToCanvas(currentPage + 1, rightCanvasRef.current, rightTaskRef.current, maxW, availH)
    } else if (rightCanvasRef.current) {
      rightCanvasRef.current.width = 0
      rightCanvasRef.current.height = 0
    }
  }, [pdf, currentPage, isMobile, showDouble, numPages, renderToCanvas])

  useEffect(() => {
    const double = !isMobile || showDouble
    const step = double ? 2 : 1
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') setCurrentPage(p => Math.min(p + step, numPages))
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') setCurrentPage(p => Math.max(1, p - step))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [numPages, isMobile, showDouble])

  const navigate = useCallback((dir: number) => {
    const double = !isMobile || showDouble
    const step = double ? 2 : 1
    setIsChanging(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setCurrentPage(p => Math.max(1, Math.min(p + dir * step, numPages)))
      timerRef.current = setTimeout(() => setIsChanging(false), 200)
    }, 120)
  }, [isMobile, showDouble, numPages])

  const double = !isMobile || showDouble
  const step = double ? 2 : 1
  const canPrev = currentPage > 1
  const canNext = currentPage + step <= numPages
  const title = [publicationName, issueTitle].filter(Boolean).join(' ')
  const pageLabel = (double && currentPage + 1 <= numPages)
    ? (String(currentPage) + ' – ' + String(currentPage + 1))
    : String(currentPage)

  if (error) {
    return (
      <div style={{ background: '#1c1917' }} className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-white/40 text-sm">{error}</p>
          <button onClick={() => window.location.reload()} className="text-white/25 text-xs hover:text-white/50 transition-colors tracking-widest uppercase">Reintentar</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: '#1c1917' }} className="min-h-screen flex flex-col select-none overflow-hidden">
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }} className="h-11 flex items-center px-5 gap-4 flex-shrink-0">
        {backUrl && (
          <Link href={backUrl} className="flex items-center gap-1 text-white/35 text-[10px] tracking-[0.2em] uppercase hover:text-white/65 transition-colors">
            <ChevronLeft size={11} />Volver
          </Link>
        )}
        {title && <span className="text-white/20 text-[10px] tracking-[0.12em] uppercase flex-1 truncate">{title}</span>}
        {isMobile && (
          <button
            onClick={() => { setShowDouble(s => !s); setCurrentPage(1) }}
            className="text-white/25 text-[9px] tracking-[0.18em] uppercase hover:text-white/55 transition-colors"
          >
            {showDouble ? '1 pag' : '2 pag'}
          </button>
        )}
      </div>

      <div className="flex-1 flex items-center justify-center relative py-6 overflow-hidden">
        <button
          onClick={() => navigate(-1)}
          disabled={!canPrev || isLoading}
          className="absolute left-0 top-0 bottom-0 w-14 md:w-20 flex items-center justify-center z-10 disabled:pointer-events-none group"
        >
          <ChevronLeft size={22} className="text-white/0 group-hover:text-white/40 transition-colors duration-150" />
        </button>

        {isLoading ? (
          <div className="flex items-center gap-0.5">
            <div className="bg-white/5 animate-pulse rounded-sm" style={{ width: 200, height: 283 }} />
            <div className="bg-white/5 animate-pulse rounded-sm hidden md:block" style={{ width: 200, height: 283 }} />
          </div>
        ) : (
          <div
            className="flex items-start"
            style={{ opacity: isChanging ? 0 : 1, transition: 'opacity 0.18s ease-out' }}
          >
            <canvas
              ref={leftCanvasRef}
              className="block rounded-sm"
              style={{
                boxShadow: double
                  ? '-4px 2px 28px rgba(0,0,0,0.72), 2px 0 10px rgba(0,0,0,0.45)'
                  : '0 6px 44px rgba(0,0,0,0.68)',
                maxWidth: double ? '48vw' : '92vw',
                maxHeight: 'calc(100vh - 140px)',
              }}
            />
            {double && currentPage + 1 <= numPages && (
              <canvas
                ref={rightCanvasRef}
                className="block rounded-sm"
                style={{
                  boxShadow: '4px 2px 28px rgba(0,0,0,0.72), -2px 0 10px rgba(0,0,0,0.45)',
                  maxWidth: '48vw',
                  maxHeight: 'calc(100vh - 140px)',
                }}
              />
            )}
          </div>
        )}

        <button
          onClick={() => navigate(1)}
          disabled={!canNext || isLoading}
          className="absolute right-0 top-0 bottom-0 w-14 md:w-20 flex items-center justify-center z-10 disabled:pointer-events-none group"
        >
          <ChevronRight size={22} className="text-white/0 group-hover:text-white/40 transition-colors duration-150" />
        </button>
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }} className="h-10 flex items-center justify-center gap-5 flex-shrink-0">
        <button onClick={() => navigate(-1)} disabled={!canPrev || isLoading} className="text-white/20 hover:text-white/50 transition-colors disabled:opacity-10">
          <ChevronLeft size={15} />
        </button>
        <span className="text-white/25 text-[11px] tracking-[0.25em] tabular-nums">
          {isLoading ? '...' : (pageLabel + ' / ' + numPages)}
        </span>
        <button onClick={() => navigate(1)} disabled={!canNext || isLoading} className="text-white/20 hover:text-white/50 transition-colors disabled:opacity-10">
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  )
}

export default PDFReader
