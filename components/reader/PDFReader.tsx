'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import * as pdfjsLib from 'pdfjs-dist'
import type { PreRenderedImages } from '@/lib/types'

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@' + pdfjsLib.version + '/build/pdf.worker.min.js'

interface PDFReaderProps {
  pdfUrl:           string
  issueId?:         string
  totalPages?:      number
  coverUrl?:        string
  backUrl?:         string
  downloadUrl?:     string
  publicationName?: string
  issueTitle?:      string
  preRendered?:     PreRenderedImages | null
  imagesStatus?:    'pending' | 'processing' | 'ready' | 'partial_error'
}

type RenderTaskLike = { cancel: () => void }

export function PDFReader({
  pdfUrl, issueId, totalPages,
  backUrl, publicationName, issueTitle,
  preRendered, imagesStatus,
}: PDFReaderProps) {
  const imagesReady = (
    imagesStatus === 'ready' &&
    !!preRendered?.slots &&
    Object.keys(preRendered.slots).length > 0
  )

  const leftCanvasRef  = useRef<HTMLCanvasElement>(null)
  const rightCanvasRef = useRef<HTMLCanvasElement>(null)
  const leftTaskRef    = useRef<{ current: RenderTaskLike | null }>({ current: null })
  const rightTaskRef   = useRef<{ current: RenderTaskLike | null }>({ current: null })
  const timerRef       = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [pdf,         setPdf]         = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [numPages,    setNumPages]    = useState(totalPages || 0)
  const [isMobile,    setIsMobile]    = useState(false)
  const [isLandscape, setIsLandscape] = useState(false)
  const [showDouble,  setShowDouble]  = useState(false)
  const [isLoading,   setIsLoading]   = useState(true)
  const [isChanging,  setIsChanging]  = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  // Mobile detection
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // View tracking
  useEffect(() => {
    if (!issueId) return
    try {
      const k = 'dw_sid'
      let sid = sessionStorage.getItem(k)
      if (!sid) { sid = crypto.randomUUID(); sessionStorage.setItem(k, sid) }
      fetch('/api/track-view', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ issueId, sessionId: sid }),
      }).catch(() => {})
    } catch (_) {}
  }, [issueId])

  // Load: use pre-rendered images when ready, otherwise load PDF.js
  useEffect(() => {
    if (imagesReady && preRendered) {
      setNumPages(preRendered.totalPdfPages)
      setIsLandscape(preRendered.isSpreadPDF)
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    const task = pdfjsLib.getDocument({
      url:        pdfUrl,
      cMapUrl:    '//cdnjs.cloudflare.com/ajax/libs/pdf.js/' + pdfjsLib.version + '/cmaps/',
      cMapPacked: true,
    })
    task.promise
      .then(async doc => {
        const checkNum  = Math.min(2, doc.numPages)
        const checkPage = await doc.getPage(checkNum)
        const vp        = checkPage.getViewport({ scale: 1 })
        setIsLandscape(vp.width > vp.height)
        setPdf(doc)
        setNumPages(doc.numPages)
        setIsLoading(false)
      })
      .catch(() => { setError('No se pudo cargar la revista.'); setIsLoading(false) })
    return () => { task.destroy().catch(() => {}) }
  }, [pdfUrl, imagesReady, preRendered])

  // Prefetch adjacent images to eliminate load delay on next/prev turn
  useEffect(() => {
    if (!imagesReady || !preRendered?.slots) return
    const neighbors = [currentPage - 1, currentPage + 1].filter(n => n >= 1 && n <= numPages)
    for (const n of neighbors) {
      if (preRendered.isSpreadPDF) {
        const l = preRendered.slots[`${n}_L`]; if (l) { const i = new Image(); i.src = l }
        const r = preRendered.slots[`${n}_R`]; if (r) { const i = new Image(); i.src = r }
      } else {
        const u = preRendered.slots[String(n)]; if (u) { const i = new Image(); i.src = u }
      }
    }
  }, [currentPage, imagesReady, preRendered, numPages])

  // PDF.js canvas rendering (fallback when images not ready)
  const renderToCanvas = useCallback(async (
    pageNum:  number,
    canvas:   HTMLCanvasElement,
    taskRef:  { current: RenderTaskLike | null },
    maxW:     number,
    maxH:     number
  ) => {
    if (!pdf || !canvas) return
    if (taskRef.current) { taskRef.current.cancel(); taskRef.current = null }
    try {
      const page  = await pdf.getPage(pageNum)
      const base  = page.getViewport({ scale: 1 })
      const scale = Math.min(maxW / base.width, maxH / base.height)
      const dpr   = window.devicePixelRatio || 1
      const vp    = page.getViewport({ scale: scale * dpr })
      canvas.width        = Math.floor(vp.width)
      canvas.height       = Math.floor(vp.height)
      canvas.style.width  = Math.floor(vp.width  / dpr) + 'px'
      canvas.style.height = Math.floor(vp.height / dpr) + 'px'
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
    if (!pdf || imagesReady) return
    const double = !isLandscape && (!isMobile || showDouble)
    const availH = window.innerHeight - 44 - 40 - 48
    const maxW   = double
      ? Math.min((window.innerWidth - 16) / 2, 580)
      : Math.min(window.innerWidth - 24, 760)
    if (leftCanvasRef.current) {
      renderToCanvas(currentPage, leftCanvasRef.current, leftTaskRef.current, maxW, availH)
    }
    const isCoverPage = currentPage === 1
    if (double && !isCoverPage && currentPage + 1 <= numPages && rightCanvasRef.current) {
      renderToCanvas(currentPage + 1, rightCanvasRef.current, rightTaskRef.current, maxW, availH)
    } else if (rightCanvasRef.current) {
      rightCanvasRef.current.width  = 0
      rightCanvasRef.current.height = 0
    }
  }, [pdf, currentPage, isMobile, showDouble, numPages, isLandscape, imagesReady, renderToCanvas])

  // Keyboard navigation
  useEffect(() => {
    const double = !isLandscape && (!isMobile || showDouble)
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        setCurrentPage(p => {
          if (!double) return Math.min(p + 1, numPages)
          if (p === 1)  return Math.min(2, numPages)
          return Math.min(p + 2, numPages)
        })
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        setCurrentPage(p => {
          if (!double) return Math.max(1, p - 1)
          if (p === 2)  return 1
          return Math.max(2, p - 2)
        })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [numPages, isMobile, showDouble, isLandscape])

  const navigate = useCallback((dir: number) => {
    const double = !isLandscape && (!isMobile || showDouble)
    setIsChanging(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setCurrentPage(p => {
        if (!double) return Math.max(1, Math.min(p + dir, numPages))
        if (dir > 0) {
          if (p === 1) return Math.min(2, numPages)
          return Math.min(p + 2, numPages)
        } else {
          if (p === 2) return 1
          return Math.max(2, p - 2)
        }
      })
      timerRef.current = setTimeout(() => setIsChanging(false), 200)
    }, 120)
  }, [isMobile, showDouble, numPages, isLandscape])

  const double     = !isLandscape && (!isMobile || showDouble)
  const isCover    = currentPage === 1
  const canPrev    = currentPage > 1
  const canNext    = double
    ? (isCover ? numPages > 1 : currentPage + 2 <= numPages)
    : currentPage < numPages
  const title      = [publicationName, issueTitle].filter(Boolean).join(' ')
  const pageLabel  = (double && !isCover && currentPage + 1 <= numPages)
    ? `${currentPage} – ${currentPage + 1}`
    : String(currentPage)

  const slot = (n: number, side?: 'L' | 'R') => {
    if (!preRendered?.slots) return ''
    return (side ? preRendered.slots[`${n}_${side}`] : preRendered.slots[String(n)]) || ''
  }

  const imgStyle = (pos: 'single' | 'left' | 'right'): React.CSSProperties => ({
    display:    'block',
    objectFit:  'contain',
    maxHeight:  'calc(100vh - 140px)',
    maxWidth:   pos === 'single' ? '92vw' : '48vw',
    boxShadow:  pos === 'single'
      ? '0 4px 32px rgba(0,0,0,0.18)'
      : pos === 'left'
        ? '-4px 2px 24px rgba(0,0,0,0.16), 2px 0 8px rgba(0,0,0,0.10)'
        : '4px 2px 24px rgba(0,0,0,0.16), -2px 0 8px rgba(0,0,0,0.10)',
    borderRadius: '2px',
  })

  const renderImages = () => {
    if (!preRendered) return null
    const { isSpreadPDF, isAllSpread } = preRendered

    if (isSpreadPDF) {
      // Page 1 of a mixed-spread PDF is a portrait cover
      if (!isAllSpread && currentPage === 1) {
        return <img src={slot(1)} alt="Portada" style={imgStyle('single')} />
      }
      return (
        <>
          <img src={slot(currentPage, 'L')} alt={`Pág. ${currentPage} izq.`} style={imgStyle('left')}  />
          <img src={slot(currentPage, 'R')} alt={`Pág. ${currentPage} der.`} style={imgStyle('right')} />
        </>
      )
    }

    // Portrait PDF: standard single or double page
    const rightUrl = (!isCover && double && currentPage + 1 <= numPages) ? slot(currentPage + 1) : null
    return (
      <>
        <img src={slot(currentPage)} alt={`Pág. ${currentPage}`} style={imgStyle(rightUrl ? 'left' : 'single')} />
        {rightUrl && <img src={rightUrl} alt={`Pág. ${currentPage + 1}`} style={imgStyle('right')} />}
      </>
    )
  }

  if (error) {
    return (
      <div style={{ background: '#f5f0e8' }} className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-black/40 text-sm">{error}</p>
          <button onClick={() => window.location.reload()} className="text-black/25 text-xs hover:text-black/50 transition-colors tracking-widest uppercase">
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: '#f5f0e8' }} className="min-h-screen flex flex-col select-none overflow-hidden">
      {/* Top bar */}
      <div style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }} className="h-11 flex items-center px-5 gap-4 flex-shrink-0">
        {backUrl && (
          <Link href={backUrl} className="flex items-center gap-1 text-black/85 text-[10px] tracking-[0.2em] uppercase hover:text-black transition-colors">
            <ChevronLeft size={11} />Volver
          </Link>
        )}
        {title && <span className="text-black/70 text-[10px] tracking-[0.12em] uppercase flex-1 truncate">{title}</span>}
        {isMobile && !isLandscape && (
          <button
            onClick={() => { setShowDouble(s => !s); setCurrentPage(1) }}
            className="text-black/65 text-[9px] tracking-[0.18em] uppercase hover:text-black transition-colors"
          >
            {showDouble ? '1 pag' : '2 pag'}
          </button>
        )}
      </div>

      {/* Main canvas / image area */}
      <div className="flex-1 flex items-center justify-center relative py-6 overflow-hidden">
        <button
          onClick={() => navigate(-1)}
          disabled={!canPrev || isLoading}
          className="absolute left-0 top-0 bottom-0 w-14 md:w-20 flex items-center justify-center z-10 disabled:pointer-events-none group hover:bg-black/[0.03] transition-colors"
        >
          <ChevronLeft size={22} className="text-black/30 group-hover:text-black/65 transition-colors duration-150" />
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
            {imagesReady ? renderImages() : (
              <>
                <canvas
                  ref={leftCanvasRef}
                  className="block rounded-sm"
                  style={{
                    boxShadow: double
                      ? '-4px 2px 24px rgba(0,0,0,0.16), 2px 0 8px rgba(0,0,0,0.10)'
                      : '0 4px 32px rgba(0,0,0,0.18)',
                    maxWidth:  double ? '48vw' : '92vw',
                    maxHeight: 'calc(100vh - 140px)',
                  }}
                />
                {double && !isCover && currentPage + 1 <= numPages && (
                  <canvas
                    ref={rightCanvasRef}
                    className="block rounded-sm"
                    style={{
                      boxShadow: '4px 2px 24px rgba(0,0,0,0.16), -2px 0 8px rgba(0,0,0,0.10)',
                      maxWidth:  '48vw',
                      maxHeight: 'calc(100vh - 140px)',
                    }}
                  />
                )}
              </>
            )}
          </div>
        )}

        <button
          onClick={() => navigate(1)}
          disabled={!canNext || isLoading}
          className="absolute right-0 top-0 bottom-0 w-14 md:w-20 flex items-center justify-center z-10 disabled:pointer-events-none group hover:bg-black/[0.03] transition-colors"
        >
          <ChevronRight size={22} className="text-black/30 group-hover:text-black/65 transition-colors duration-150" />
        </button>
      </div>

      {/* Bottom pagination bar */}
      <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }} className="h-10 flex items-center justify-center gap-5 flex-shrink-0">
        <button onClick={() => navigate(-1)} disabled={!canPrev || isLoading} className="text-black/25 hover:text-black/55 transition-colors disabled:opacity-10">
          <ChevronLeft size={15} />
        </button>
        <span className="text-black/40 text-[11px] tracking-[0.25em] tabular-nums">
          {isLoading ? '…' : `${pageLabel} / ${numPages}`}
        </span>
        <button onClick={() => navigate(1)} disabled={!canNext || isLoading} className="text-black/25 hover:text-black/55 transition-colors disabled:opacity-10">
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  )
}

export default PDFReader
