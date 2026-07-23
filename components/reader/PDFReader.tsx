﻿'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Minimize2 } from 'lucide-react'
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

  // ── Canvas / task refs ───────────────────────────────────────────────────
  const leftCanvasRef  = useRef<HTMLCanvasElement>(null)
  const rightCanvasRef = useRef<HTMLCanvasElement>(null)
  const leftTaskRef    = useRef<{ current: RenderTaskLike | null }>({ current: null })
  const rightTaskRef   = useRef<{ current: RenderTaskLike | null }>({ current: null })
  const timerRef       = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contentRef     = useRef<HTMLDivElement>(null)
  const thumbStripRef  = useRef<HTMLDivElement>(null)
  const activeThumbRef = useRef<HTMLButtonElement | null>(null)

  // ── Reader state ─────────────────────────────────────────────────────────
  const [pdf,         setPdf]         = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [numPages,    setNumPages]    = useState(totalPages || 0)
  const [isMobile,    setIsMobile]    = useState(false)
  const [isLandscape, setIsLandscape] = useState(false)
  const [showDouble,  setShowDouble]  = useState(true)
  const [isLoading,   setIsLoading]   = useState(true)
  const [isChanging,  setIsChanging]  = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  // ── Zoom / pan state ─────────────────────────────────────────────────────
  const [zoom, setZoom] = useState(1)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const zoomRef           = useRef(1)
  const panRef            = useRef({ x: 0, y: 0 })
  // drag
  const isDragging        = useRef(false)
  const dragStart         = useRef({ x: 0, y: 0 })
  const panAtDragStart    = useRef({ x: 0, y: 0 })
  // pinch
  const isPinching        = useRef(false)
  const pinchDist         = useRef<number | null>(null)
  const pinchZoomStart    = useRef(1)
  // swipe / double-tap
  const swipeStart        = useRef<{ x: number; y: number } | null>(null)
  const lastTapTime       = useRef(0)
  // navigate ref for touch handler (avoids stale closure)
  const navigateRef       = useRef<((dir: number) => void) | null>(null)

  const applyZoom = useCallback((z: number, px = panRef.current.x, py = panRef.current.y) => {
    const newZ  = Math.max(0.5, Math.min(4, z))
    const newPx = newZ <= 1.01 ? 0 : px
    const newPy = newZ <= 1.01 ? 0 : py
    zoomRef.current = newZ
    panRef.current  = { x: newPx, y: newPy }
    setZoom(newZ)
    setPanX(newPx)
    setPanY(newPy)
  }, [])

  const resetZoom = useCallback(() => applyZoom(1, 0, 0), [applyZoom])

  // ── Mobile detection ─────────────────────────────────────────────────────
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // ── View tracking ────────────────────────────────────────────────────────
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

  // ── Load: pre-rendered images or PDF.js fallback ─────────────────────────
  useEffect(() => {
    if (imagesReady && preRendered) {
      setNumPages(preRendered.totalPdfPages)
      setIsLandscape(preRendered.isSpreadPDF)
      setIsLoading(false)
      if ((preRendered.errorPages?.length ?? 0) === 0) return
    } else {
      setIsLoading(true)
      setError(null)
    }
    const task = pdfjsLib.getDocument({
      url:        pdfUrl,
      cMapUrl:    '//cdnjs.cloudflare.com/ajax/libs/pdf.js/' + pdfjsLib.version + '/cmaps/',
      cMapPacked: true,
    })
    task.promise
      .then(async doc => {
        if (!imagesReady) {
          const checkNum  = Math.min(2, doc.numPages)
          const checkPage = await doc.getPage(checkNum)
          const vp        = checkPage.getViewport({ scale: 1 })
          setIsLandscape(vp.width > vp.height)
          setNumPages(doc.numPages)
          setIsLoading(false)
        }
        setPdf(doc)
      })
      .catch(() => {
        if (!imagesReady) { setError('No se pudo cargar la revista.'); setIsLoading(false) }
      })
    return () => { task.destroy().catch(() => {}) }
  }, [pdfUrl, imagesReady, preRendered])

  // ── Prefetch adjacent images ──────────────────────────────────────────────
  useEffect(() => {
    if (!imagesReady || !preRendered?.slots) return
    const neighbors = [currentPage - 1, currentPage + 1].filter(n => n >= 1 && n <= numPages)
    for (const n of neighbors) {
      if (preRendered.isSpreadPDF) {
        const l = preRendered.slots[`${n}_L`]; if (l) { const img = new Image(); img.src = l }
        const r = preRendered.slots[`${n}_R`]; if (r) { const img = new Image(); img.src = r }
      } else {
        const u = preRendered.slots[String(n)]; if (u) { const img = new Image(); img.src = u }
      }
    }
  }, [currentPage, imagesReady, preRendered, numPages])

  // ── PDF.js canvas rendering ───────────────────────────────────────────────
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
    if (!pdf) return
    if (imagesReady) {
      const inErrorPages = (preRendered?.errorPages ?? []).includes(currentPage)
      const hasValidSlot = !inErrorPages && (
        preRendered?.isSpreadPDF
          ? !!(preRendered.slots?.[`${currentPage}_L`] || preRendered.slots?.[`${currentPage}_R`])
          : !!(preRendered?.slots ?? {})[String(currentPage)]
      )
      if (hasValidSlot) return
    }
    const double = !isLandscape && (!isMobile && showDouble)
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

  // ── Keyboard navigation ───────────────────────────────────────────────────
  useEffect(() => {
    const double = !isLandscape && (!isMobile && showDouble)
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { resetZoom(); return }
      if (zoomRef.current > 1.01) return
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
  }, [numPages, isMobile, showDouble, isLandscape, resetZoom])

  // ── Ctrl+wheel zoom ───────────────────────────────────────────────────────
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12
      applyZoom(zoomRef.current * factor)
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => window.removeEventListener('wheel', onWheel)
  }, [applyZoom])

  // ── Mouse drag pan ────────────────────────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoomRef.current <= 1.01) return
    isDragging.current     = true
    dragStart.current      = { x: e.clientX, y: e.clientY }
    panAtDragStart.current = { ...panRef.current }
    e.preventDefault()
  }, [])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const dx = e.clientX - dragStart.current.x
      const dy = e.clientY - dragStart.current.y
      applyZoom(zoomRef.current, panAtDragStart.current.x + dx, panAtDragStart.current.y + dy)
    }
    const onMouseUp = () => { isDragging.current = false }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [applyZoom])

  // ── Touch: pinch-to-zoom + drag pan + swipe nav + double-tap reset ────────
  useEffect(() => {
    const el = contentRef.current
    if (!el) return

    const getDist = (t: TouchList) => {
      const dx = t[0].clientX - t[1].clientX
      const dy = t[0].clientY - t[1].clientY
      return Math.sqrt(dx * dx + dy * dy)
    }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        isPinching.current     = true
        pinchDist.current      = getDist(e.touches)
        pinchZoomStart.current = zoomRef.current
        swipeStart.current     = null
      } else if (e.touches.length === 1) {
        const t = e.touches[0]
        const now = Date.now()
        if (now - lastTapTime.current < 300 && zoomRef.current !== 1) {
          resetZoom()
        }
        lastTapTime.current = now
        swipeStart.current  = { x: t.clientX, y: t.clientY }
        if (zoomRef.current > 1.01) {
          isDragging.current     = true
          dragStart.current      = { x: t.clientX, y: t.clientY }
          panAtDragStart.current = { ...panRef.current }
        }
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && isPinching.current && pinchDist.current !== null) {
        e.preventDefault()
        const dist   = getDist(e.touches)
        const factor = dist / pinchDist.current
        applyZoom(pinchZoomStart.current * factor)
      } else if (e.touches.length === 1 && isDragging.current && zoomRef.current > 1.01) {
        e.preventDefault()
        const dx = e.touches[0].clientX - dragStart.current.x
        const dy = e.touches[0].clientY - dragStart.current.y
        applyZoom(zoomRef.current, panAtDragStart.current.x + dx, panAtDragStart.current.y + dy)
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        isPinching.current = false
        pinchDist.current  = null
      }
      if (e.touches.length === 0) {
        isDragging.current = false
        if (swipeStart.current && zoomRef.current <= 1.01 && e.changedTouches.length === 1) {
          const dx = e.changedTouches[0].clientX - swipeStart.current.x
          const dy = e.changedTouches[0].clientY - swipeStart.current.y
          if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
            navigateRef.current?.(dx < 0 ? 1 : -1)
          }
        }
        swipeStart.current = null
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove',  onTouchMove,  { passive: false })
    el.addEventListener('touchend',   onTouchEnd,   { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove',  onTouchMove)
      el.removeEventListener('touchend',   onTouchEnd)
    }
  }, [applyZoom, resetZoom])

  // ── navigate ──────────────────────────────────────────────────────────────
  const navigate = useCallback((dir: number) => {
    if (zoomRef.current > 1.01) return
    const double = !isLandscape && (!isMobile && showDouble)
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

  useEffect(() => { navigateRef.current = navigate }, [navigate])

  // Auto-scroll thumbnail strip so the active thumb stays visible
  useEffect(() => {
    activeThumbRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [currentPage])

  // ── Derived values ────────────────────────────────────────────────────────
  const double    = !isLandscape && (!isMobile && showDouble)
  const isCover   = currentPage === 1
  const canPrev   = currentPage > 1
  const canNext   = double
    ? (isCover ? numPages > 1 : currentPage + 2 <= numPages)
    : currentPage < numPages
  const title     = [publicationName, issueTitle].filter(Boolean).join(' ')
  const pageLabel = (double && !isCover && currentPage + 1 <= numPages)
    ? `${currentPage} – ${currentPage + 1}`
    : String(currentPage)
  const isZoomed  = zoom > 1.01

  // ── Image helpers ─────────────────────────────────────────────────────────
  const slot = (n: number, side?: 'L' | 'R') => {
    if (!preRendered?.slots) return ''
    return (side ? preRendered.slots[`${n}_${side}`] : preRendered.slots[String(n)]) || ''
  }

  const imgStyle = (pos: 'single' | 'left' | 'right'): React.CSSProperties => ({
    display:          'block',
    objectFit:        'contain',
    maxHeight:        'calc(100vh - 140px)',
    maxWidth:         pos === 'single' ? '92vw' : '48vw',
    boxShadow:        pos === 'single'
      ? '0 4px 32px rgba(0,0,0,0.18)'
      : pos === 'left'
        ? '-4px 2px 24px rgba(0,0,0,0.16), 2px 0 8px rgba(0,0,0,0.10)'
        : '4px 2px 24px rgba(0,0,0,0.16), -2px 0 8px rgba(0,0,0,0.10)',
    borderRadius:     '2px',
    userSelect:       'none',
    WebkitUserSelect: 'none',
    pointerEvents:    'none',
  })

  const renderImages = () => {
    if (!preRendered) return null
    const { isSpreadPDF, isAllSpread } = preRendered
    if (isSpreadPDF) {
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
      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <div style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }} className="h-11 flex items-center px-5 gap-4 flex-shrink-0">
        {backUrl && (
          <Link href={backUrl} className="flex items-center gap-1 text-black/85 text-[10px] tracking-[0.2em] uppercase hover:text-black transition-colors">
            <ChevronLeft size={11} />Volver
          </Link>
        )}
        {title && <span className="text-black/70 text-[10px] tracking-[0.12em] uppercase flex-1 truncate">{title}</span>}
        {!isMobile && !isLandscape && (
          <button
            onClick={() => { setShowDouble(s => !s); setCurrentPage(1) }}
            className="text-black/65 text-[9px] tracking-[0.18em] uppercase hover:text-black transition-colors"
          >
            {showDouble ? '1 pág' : '2 págs'}
          </button>
        )}
      </div>

      {/* ── Main content area ────────────────────────────────────────── */}
      <div
        ref={contentRef}
        className="flex-1 flex items-center justify-center relative py-6 overflow-hidden"
        style={{ cursor: isZoomed ? (isDragging.current ? 'grabbing' : 'grab') : 'default' }}
        onMouseDown={onMouseDown}
      >
        {/* Nav arrows hidden when zoomed */}
        {!isZoomed && (
          <button
            onClick={() => navigate(-1)}
            disabled={!canPrev || isLoading}
            className="absolute left-0 top-0 bottom-0 w-14 md:w-20 flex items-center justify-center z-10 disabled:pointer-events-none group hover:bg-black/[0.03] transition-colors"
          >
            <ChevronLeft size={22} className="text-black/30 group-hover:text-black/65 transition-colors duration-150" />
          </button>
        )}

        {isLoading ? (
          <div className="flex items-center gap-0.5">
            <div className="bg-white/5 animate-pulse rounded-sm" style={{ width: 200, height: 283 }} />
            <div className="bg-white/5 animate-pulse rounded-sm hidden md:block" style={{ width: 200, height: 283 }} />
          </div>
        ) : (
          <div
            className="flex items-start"
            style={{
              opacity:         isChanging ? 0 : 1,
              transition:      'opacity 0.18s ease-out',
              transform:       `translate(${panX}px, ${panY}px) scale(${zoom})`,
              transformOrigin: 'center center',
              willChange:      'transform',
            }}
          >
            {(imagesReady &&
              (preRendered?.isSpreadPDF
                ? !!(preRendered?.slots?.[`${currentPage}_L`] || preRendered?.slots?.[`${currentPage}_R`])
                : !!slot(currentPage)) &&
              !(preRendered?.errorPages ?? []).includes(currentPage)) ? renderImages() : (
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

        {/* Reset zoom button, visible only when zoomed */}
        {isZoomed && !isLoading && (
          <button
            onClick={resetZoom}
            title="Restablecer zoom (Esc)"
            className="absolute top-3 right-3 z-20 bg-black/10 hover:bg-black/20 text-black/55 rounded-full p-2 transition-colors"
          >
            <Minimize2 size={13} />
          </button>
        )}

        {!isZoomed && (
          <button
            onClick={() => navigate(1)}
            disabled={!canNext || isLoading}
            className="absolute right-0 top-0 bottom-0 w-14 md:w-20 flex items-center justify-center z-10 disabled:pointer-events-none group hover:bg-black/[0.03] transition-colors"
          >
            <ChevronRight size={22} className="text-black/30 group-hover:text-black/65 transition-colors duration-150" />
          </button>
        )}
      </div>

      {/* ── Thumbnail strip ─────────────────────────────────────────── */}
      {imagesReady && !isLoading && !isZoomed && preRendered && (
        <div
          ref={thumbStripRef}
          className="flex gap-1.5 px-4 py-2 overflow-x-auto flex-shrink-0"
          style={{ background: 'rgba(0,0,0,0.05)', borderTop: '1px solid rgba(0,0,0,0.07)', scrollbarWidth: 'none' }}
        >
          {Array.from({ length: numPages }, (_, i) => i + 1).map(n => {
            const isActivePage = n === currentPage || (double && !isCover && n === currentPage + 1)
            const thumbUrl = preRendered.isSpreadPDF
              ? (preRendered.slots[`${n}_L`] || '')
              : (preRendered.slots[String(n)] || '')
            if (!thumbUrl) return null
            return (
              <button
                key={n}
                ref={n === currentPage ? activeThumbRef : undefined}
                onClick={() => { resetZoom(); setCurrentPage(n) }}
                title={`Pág. ${n}`}
                className="flex-shrink-0 focus:outline-none"
                style={{ opacity: isActivePage ? 1 : 0.38, transition: 'opacity 0.15s' }}
              >
                <img
                  src={thumbUrl}
                  alt={`Pág. ${n}`}
                  style={{
                    height: 52,
                    width: 'auto',
                    borderRadius: 2,
                    display: 'block',
                    border: isActivePage ? '2px solid rgba(0,0,0,0.75)' : '2px solid transparent',
                    pointerEvents: 'none',
                  }}
                />
              </button>
            )
          })}
        </div>
      )}

      {/* ── Bottom bar ───────────────────────────────────────────────── */}
      <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }} className="h-10 flex items-center justify-between px-5 flex-shrink-0">
        {/* Pagination */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} disabled={!canPrev || isLoading || isZoomed} className="text-black/25 hover:text-black/55 transition-colors disabled:opacity-20">
            <ChevronLeft size={15} />
          </button>
          <span className="text-black/40 text-[11px] tracking-[0.25em] tabular-nums">
            {isLoading ? '…' : `${pageLabel} / ${numPages}`}
          </span>
          <button onClick={() => navigate(1)} disabled={!canNext || isLoading || isZoomed} className="text-black/25 hover:text-black/55 transition-colors disabled:opacity-20">
            <ChevronRight size={15} />
          </button>
        </div>
        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => applyZoom(zoomRef.current / 1.25)}
            disabled={zoom <= 0.51}
            className="text-black/30 hover:text-black/60 transition-colors disabled:opacity-20 p-1"
            title="Alejar"
          >
            <ZoomOut size={14} />
          </button>
          <span className="text-[10px] text-black/30 tabular-nums w-9 text-center select-none">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => applyZoom(zoomRef.current * 1.25)}
            disabled={zoom >= 3.99}
            className="text-black/30 hover:text-black/60 transition-colors disabled:opacity-20 p-1"
            title="Acercar"
          >
            <ZoomIn size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default PDFReader




