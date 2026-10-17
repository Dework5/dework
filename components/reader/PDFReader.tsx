﻿'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Minimize2, BookOpen, List, LayoutGrid, X } from 'lucide-react'
import * as pdfjsLib from 'pdfjs-dist'
import type { PreRenderedImages, Nota } from '@/lib/types'
import NoteReader from './NoteReader'

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
  const showDoubleRef = useRef(true)
  useEffect(() => { showDoubleRef.current = showDouble }, [showDouble])
  const [isLoading,   setIsLoading]   = useState(true)
  const [isChanging,  setIsChanging]  = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  // Modo lectura (notas en letra de celular), índice y miniaturas en el celular
  const [lectura,     setLectura]     = useState<Nota | null>(null)
  const [verIndice,   setVerIndice]   = useState(false)
  const [verPaginas,  setVerPaginas]  = useState(false)
  const [pista,       setPista]       = useState(false)
  // Desde dónde llegó el lector a una nota (página del índice o la lista de notas), para poder volver
  const [volverA,     setVolverA]     = useState<number | 'lista' | null>(null)
  const notas = preRendered?.notas ?? []

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

  // Ir a una página concreta. En doble página los pliegos son (par, impar): se muestra el pliego que la contiene.
  const goToPage = useCallback((n: number) => {
    resetZoom()
    const target = Math.max(1, Math.min(n, preRendered?.totalPdfPages ?? n))
    const enDoble = !(preRendered?.isSpreadPDF) && window.innerWidth >= 768 && showDoubleRef.current
    setCurrentPage(enDoble && target > 1 && target % 2 === 1 ? target - 1 : target)
  }, [resetZoom, preRendered])

  // Link directo a una nota: /revistas/.../144?nota=futbolgolf
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('nota')
    const n = id ? preRendered?.notas?.find(x => x.id === id) : null
    if (n) setLectura(n)
  }, [preRendered])

  // En el celular, la primera vez: "deslizá para pasar de página"
  useEffect(() => {
    if (window.innerWidth >= 768) return
    try {
      if (localStorage.getItem('dework-pista-swipe')) return
      localStorage.setItem('dework-pista-swipe', '1')
    } catch { /* sin almacenamiento: igual la mostramos */ }
    setPista(true)
    const t = setTimeout(() => setPista(false), 3500)
    return () => clearTimeout(t)
  }, [])

  // Link directo a una página: /revistas/.../144?p=10
  useEffect(() => {
    const p = parseInt(new URLSearchParams(window.location.search).get('p') ?? '', 10)
    if (p > 1) goToPage(p)
  }, [goToPage])

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

  // ── Página destino al avanzar/retroceder (en doble página los pliegos son 1 | 2-3 | 4-5 …) ──
  const targetFrom = useCallback((p: number, dir: number) => {
    const double = !isLandscape && (!isMobile && showDouble)
    if (!double) return Math.max(1, Math.min(p + dir, numPages))
    if (dir > 0) return p === 1 ? Math.min(2, numPages) : Math.min(p + 2, numPages)
    if (p <= 1) return 1
    return p === 2 ? 1 : Math.max(2, p - 2)
  }, [isLandscape, isMobile, showDouble, numPages])

  // Imágenes que forman la vista de una página (una sola o el pliego completo)
  const spreadUrls = useCallback((p: number): string[] => {
    if (!preRendered?.slots) return []
    if (preRendered.isSpreadPDF) {
      return [preRendered.slots[String(p)], preRendered.slots[`${p}_L`], preRendered.slots[`${p}_R`]].filter(Boolean) as string[]
    }
    const double = !isLandscape && !isMobile && showDouble
    const pages = double && p > 1 ? [p, p + 1] : [p]
    return pages.filter(n => n >= 1 && n <= numPages).map(n => preRendered.slots[String(n)]).filter(Boolean)
  }, [preRendered, isLandscape, isMobile, showDouble, numPages])

  // Descarga y decodifica una imagen una sola vez (las promesas quedan guardadas)
  const decodedRef = useRef(new Map<string, Promise<void>>())
  const preload = useCallback((url: string) => {
    let pr = decodedRef.current.get(url)
    if (!pr) {
      const img = new Image()
      pr = new Promise<void>(resolve => {
        img.onload = () => resolve()
        img.onerror = () => resolve()
      })
      img.src = url
      decodedRef.current.set(url, pr)
    }
    return pr
  }, [])

  // ── Precarga: deja listos el pliego siguiente, el anterior y el que viene después ──
  useEffect(() => {
    if (!imagesReady) return
    const next1 = targetFrom(currentPage, 1)
    for (const p of [next1, targetFrom(currentPage, -1), targetFrom(next1, 1)]) spreadUrls(p).forEach(preload)
  }, [currentPage, imagesReady, targetFrom, spreadUrls, preload])

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
      // Render at 2.5× resolution so the canvas stays crisp when zoomed
      const QUALITY = 2.5
      const vp    = page.getViewport({ scale: scale * dpr * QUALITY })
      canvas.width        = Math.floor(vp.width)
      canvas.height       = Math.floor(vp.height)
      canvas.style.width  = Math.floor(vp.width  / (dpr * QUALITY)) + 'px'
      canvas.style.height = Math.floor(vp.height / (dpr * QUALITY)) + 'px'
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
          // support old _L/_R format AND new Cloudinary plain-key format
          ? !!(preRendered.slots?.[`${currentPage}_L`] || preRendered.slots?.[`${currentPage}_R`] || preRendered.slots?.[String(currentPage)])
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
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { resetZoom(); return }
      if (zoomRef.current > 1.01) return
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') navigateRef.current?.(1)
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') navigateRef.current?.(-1)
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
  // Página "pedida" (puede adelantarse a currentPage mientras se carga el pliego nuevo)
  const pageRef = useRef(1)
  useEffect(() => { pageRef.current = currentPage }, [currentPage])

  const navigate = useCallback((dir: number) => {
    if (zoomRef.current > 1.01) return
    const target = targetFrom(pageRef.current, dir)
    if (target === pageRef.current) return
    pageRef.current = target
    if (imagesReady) {
      // Con imágenes: el cambio es instantáneo y las dos páginas del pliego aparecen juntas.
      // Si todavía no llegaron, se espera a que estén (como máximo 1,5 s) en vez de mostrar media página.
      const listo = Promise.all(spreadUrls(target).map(preload))
      Promise.race([listo, new Promise(r => setTimeout(r, 1500))]).then(() => {
        if (pageRef.current === target) setCurrentPage(target)
      })
      return
    }
    // Con PDF (ediciones sin imágenes): mismo fundido de antes
    setIsChanging(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setCurrentPage(target)
      timerRef.current = setTimeout(() => setIsChanging(false), 200)
    }, 120)
  }, [imagesReady, targetFrom, spreadUrls, preload])

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
  const notaActual = notas.find(n => (currentPage >= n.desde && currentPage <= n.hasta) || (double && !isCover && currentPage + 1 >= n.desde && currentPage + 1 <= n.hasta)) ?? null
  const siguienteDe = (n: Nota) => notas[notas.findIndex(x => x.id === n.id) + 1] ?? null
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
    maxHeight:        isMobile ? 'calc(100dvh - 104px)' : 'calc(100vh - 140px)',
    maxWidth:         pos === 'single' ? (isMobile ? '97vw' : '92vw') : '48vw',
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
      // Cloudinary format: full landscape image in a plain-key slot (no _L/_R)
      const fullSpreadUrl = preRendered.slots?.[String(currentPage)]
      if (fullSpreadUrl && !preRendered.slots?.[`${currentPage}_L`]) {
        return (
          <img
            src={fullSpreadUrl}
            alt={`Pág. ${currentPage}`}
            style={{
              display:          'block',
              objectFit:        'contain',
              maxHeight:        'calc(100vh - 140px)',
              maxWidth:         '96vw',
              boxShadow:        '0 4px 32px rgba(0,0,0,0.18)',
              borderRadius:     '2px',
              userSelect:       'none',
              WebkitUserSelect: 'none',
              pointerEvents:    'none',
            }}
          />
        )
      }
      // Legacy format: separate _L and _R halves
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
        {pageWithLinks(currentPage, <img src={slot(currentPage)} alt={`Pág. ${currentPage}`} style={imgStyle(rightUrl ? 'left' : 'single')} />)}
        {rightUrl && pageWithLinks(currentPage + 1, <img src={rightUrl} alt={`Pág. ${currentPage + 1}`} style={imgStyle('right')} />)}
      </>
    )
  }

  // Zonas clickeables sobre una página (índice -> nota, avisos -> web/WhatsApp). Coordenadas en fracción de la página.
  const pageWithLinks = (n: number, img: React.ReactNode) => {
    const links = preRendered?.links?.[String(n)]
    if (!links?.length) return img
    return (
      <div style={{ position: 'relative' }}>
        {img}
        {links.map((l, i) => {
          const style: React.CSSProperties = {
            position: 'absolute', left: `${l.x * 100}%`, top: `${l.y * 100}%`, width: `${l.w * 100}%`, height: `${l.h * 100}%`,
            cursor: 'pointer', borderRadius: 3,
          }
          const titulo = l.title ?? (l.page ? `Ir a la pág. ${l.page}` : l.url)
          return l.url
            ? <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" title={titulo} aria-label={titulo} style={style} className="hover:bg-black/5 transition-colors" onPointerDown={e => e.stopPropagation()} />
            : <button key={i} type="button" title={titulo} aria-label={titulo} style={style} className="hover:bg-black/5 transition-colors" onPointerDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); if (l.page) { setVolverA(pageRef.current); goToPage(l.page) } }} />
        })}
      </div>
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
    <div style={{ background: '#f5f0e8' }} className={`${isMobile ? 'h-[100dvh]' : 'min-h-screen'} flex flex-col select-none overflow-hidden`}>
      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <div style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }} className="h-11 flex items-center px-5 gap-4 flex-shrink-0">
        {backUrl && (
          <Link href={backUrl} className="flex items-center gap-1 text-black/85 text-[10px] tracking-[0.2em] uppercase hover:text-black transition-colors">
            <ChevronLeft size={11} />Volver
          </Link>
        )}
        {title && <span className="text-black/70 text-[10px] tracking-[0.12em] uppercase flex-1 truncate">{title}</span>}
        {notas.length > 0 && (
          <button onClick={() => setVerIndice(true)} className="flex items-center gap-1.5 text-black/75 text-[10px] tracking-[0.18em] uppercase hover:text-black transition-colors">
            <List size={13} />Índice
          </button>
        )}
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
        className={`flex-1 flex items-center justify-center relative overflow-hidden ${isMobile ? 'py-1' : 'py-6'}`}
        style={{ cursor: isZoomed ? (isDragging.current ? 'grabbing' : 'grab') : 'default' }}
        onMouseDown={onMouseDown}
      >
        {/* Nav arrows hidden when zoomed */}
        {!isZoomed && !isMobile && (
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
                ? !!(preRendered?.slots?.[`${currentPage}_L`] || preRendered?.slots?.[`${currentPage}_R`] || preRendered?.slots?.[String(currentPage)])
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

        {!isZoomed && !isMobile && (
          <button
            onClick={() => navigate(1)}
            disabled={!canNext || isLoading}
            className="absolute right-0 top-0 bottom-0 w-14 md:w-20 flex items-center justify-center z-10 disabled:pointer-events-none group hover:bg-black/[0.03] transition-colors"
          >
            <ChevronRight size={22} className="text-black/30 group-hover:text-black/65 transition-colors duration-150" />
          </button>
        )}
      </div>

      {/* ── Botón de lectura: aparece en las páginas que tienen una nota ── */}
      {notaActual && !lectura && !isZoomed && (
        <button
          onClick={() => setLectura(notaActual)}
          className="fixed left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 rounded-full shadow-lg"
          style={{ bottom: isMobile ? (verPaginas ? 118 : 54) : (imagesReady ? 128 : 56), background: '#16362B', color: '#F4EFE4', padding: isMobile ? '12px 22px' : '10px 20px', animation: 'dwFade .35s ease-out' }}
        >
          <BookOpen size={16} style={{ color: '#D9C29A' }} />
          <span className="text-[11px] tracking-[0.2em] uppercase whitespace-nowrap">Leer la nota</span>
        </button>
      )}

      {/* ── Volver al índice: cuando se llegó a la nota desde el índice ── */}
      {volverA !== null && volverA !== currentPage && !lectura && !isZoomed && (
        <button
          onClick={() => { const v = volverA; setVolverA(null); if (v === 'lista') setVerIndice(true); else goToPage(v) }}
          className="fixed left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-full shadow-md"
          style={{ top: 54, background: '#F4EFE4', color: '#16362B', border: '1px solid #B08D57', padding: '8px 16px', animation: 'dwFade .35s ease-out' }}
        >
          <ChevronLeft size={14} />
          <span className="text-[10px] tracking-[0.2em] uppercase whitespace-nowrap">Volver al índice</span>
        </button>
      )}

      {pista && (
        <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none rounded-full px-5 py-3 text-[12px] tracking-[0.12em]" style={{ background: 'rgba(22,54,43,.88)', color: '#F4EFE4', animation: 'dwFade .35s ease-out' }}>
          ← Deslizá para pasar de página →
        </div>
      )}

      {/* ── Índice de notas ── */}
      {verIndice && (
        <div className="fixed inset-0 z-40 flex items-end md:items-center justify-center" style={{ background: 'rgba(0,0,0,.45)' }} onClick={() => setVerIndice(false)}>
          <div className="w-full md:max-w-md max-h-[80dvh] overflow-y-auto rounded-t-2xl md:rounded-2xl" style={{ background: '#F4EFE4', animation: 'dwUp .25s ease-out' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 pt-5 pb-3" style={{ borderBottom: '1px solid #B08D57' }}>
              <span className="text-[11px] tracking-[0.3em] uppercase" style={{ color: '#16362B' }}>En esta edición</span>
              <button onClick={() => setVerIndice(false)} aria-label="Cerrar"><X size={18} /></button>
            </div>
            {notas.map(n => (
              <div key={n.id} className="flex items-center gap-4 px-6 py-4" style={{ borderBottom: '1px solid rgba(176,141,87,.35)' }}>
                <button className="flex-1 text-left" onClick={() => { setVerIndice(false); setLectura(n) }}>
                  <div className="text-[10px] tracking-[0.25em] uppercase mb-1" style={{ color: '#B08D57' }}>{n.seccion} · pág. {n.desde}</div>
                  <div className="text-[17px] leading-snug" style={{ color: '#16362B', fontFamily: 'Georgia, serif' }}>{n.titulo}{n.tituloCursiva ? <i> {n.tituloCursiva}</i> : null}</div>
                </button>
                <button onClick={() => { setVerIndice(false); setVolverA('lista'); goToPage(n.desde) }} className="text-[9px] tracking-[0.2em] uppercase text-black/45 whitespace-nowrap">Ver pág.</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {lectura && (
        <NoteReader
          nota={lectura}
          siguiente={siguienteDe(lectura)}
          onClose={() => setLectura(null)}
          onAbrir={n => setLectura(n)}
          onVerEnRevista={p => { setLectura(null); goToPage(p) }}
          onIndice={notas.length ? () => { setLectura(null); setVolverA(null); setVerIndice(true) } : undefined}
        />
      )}

      <style>{`@keyframes dwFade{from{opacity:0;transform:translate(-50%,6px)}to{opacity:1}}@keyframes dwUp{from{transform:translateY(30px);opacity:0}to{transform:none;opacity:1}}`}</style>

      {/* ── Thumbnail strip ─────────────────────────────────────────── */}
      {imagesReady && !isLoading && !isZoomed && preRendered && (!isMobile || verPaginas) && (
        <div
          ref={thumbStripRef}
          className="flex gap-1.5 px-4 py-2 overflow-x-auto flex-shrink-0"
          style={{ background: 'rgba(0,0,0,0.05)', borderTop: '1px solid rgba(0,0,0,0.07)', scrollbarWidth: 'none' }}
        >
          {Array.from({ length: numPages }, (_, i) => i + 1).map(n => {
            const isActivePage = n === currentPage || (double && !isCover && n === currentPage + 1)
            // Support both Cloudinary (plain key) and legacy (_L/_R) spread formats
            const fullUrl = preRendered.isSpreadPDF
              ? (preRendered.slots[String(n)] || preRendered.slots[`${n}_L`] || '')
              : (preRendered.slots[String(n)] || '')
            // Ediciones armadas por el estudio: cada página tiene versión chica (-800) junto a la grande (-1600)
            const thumbUrl = fullUrl.replace(/-1600\.webp$/, '-800.webp')
            if (!thumbUrl) return null
            return (
              <button
                key={n}
                ref={n === currentPage ? activeThumbRef : undefined}
                onClick={() => goToPage(n)}
                title={`Pág. ${n}`}
                className="flex-shrink-0 focus:outline-none"
                style={{ opacity: isActivePage ? 1 : 0.38, transition: 'opacity 0.15s' }}
              >
                <img
                  src={thumbUrl}
                  alt={`Pág. ${n}`}
                  fetchPriority="low"
                  decoding="async"
                  style={{
                    height: 52,
                    width: 'auto',
                    // Reserva el lugar antes de cargar: sin esto la carga diferida no arranca (miniatura de ancho 0)
                    aspectRatio: preRendered.isSpreadPDF ? '420 / 297' : '210 / 297',
                    objectFit: 'cover',
                    background: 'rgba(0,0,0,0.06)',
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
        {isMobile && imagesReady && (
          <button onClick={() => setVerPaginas(v => !v)} className="flex items-center gap-1.5 text-black/60 text-[10px] tracking-[0.18em] uppercase">
            <LayoutGrid size={13} />{verPaginas ? 'Ocultar' : 'Páginas'}
          </button>
        )}
        {/* Zoom controls */}
        <div className={`${isMobile ? 'hidden' : 'flex'} items-center gap-1`}>
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




