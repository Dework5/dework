'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import * as pdfjsLib from 'pdfjs-dist'
import type { PreRenderedImages } from '@/lib/types'

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

interface PDFReaderProps {
  pdfUrl:           string
  issueId:          string
  totalPages?:      number
  coverUrl?:        string
  backUrl:          string
  downloadUrl?:     string
  publicationName?: string
  issueTitle?:      string
  /** When provided, skip browser-side PDF rendering and use pre-rendered images directly. */
  preRendered?:     PreRenderedImages | null
}

const GOLD = '#C8961E'

// Clean white reading environment — bright, paper-like, lets the magazine stand out
const READER_BG: React.CSSProperties = {
  backgroundColor: '#F5F3F0',
}

// Play a subtle page-turn sound
function playPageSound() {
  try {
    const ctx  = new AudioContext()
    const sr   = ctx.sampleRate
    const len  = Math.floor(sr * 0.10)
    const buf  = ctx.createBuffer(1, len, sr)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) {
      const t = i / len
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.5) * 0.36
    }
    const src = ctx.createBufferSource(); src.buffer = buf
    const bpf = ctx.createBiquadFilter(); bpf.type = 'bandpass'
    bpf.frequency.value = 3200; bpf.Q.value = 0.75
    const gain = ctx.createGain(); gain.gain.value = 0.55
    src.connect(bpf); bpf.connect(gain); gain.connect(ctx.destination)
    src.start(); src.onended = () => ctx.close().catch(() => {})
  } catch { /* silent */ }
}

export default function PDFReader({
  pdfUrl, issueId, totalPages, coverUrl,
  backUrl, downloadUrl, publicationName, issueTitle, preRendered,
}: PDFReaderProps) {

  const [pdf,         setPdf]         = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [numPages,    setNumPages]    = useState(totalPages || 0)
  const [currentPage, setCurrentPage] = useState(1)
  const [scale,       setScale]       = useState(1)
  const [isLoading,   setIsLoading]   = useState(true)  // PDF not yet parsed
  const [error,       setError]       = useState<string | null>(null)
  const [loadSlow,    setLoadSlow]    = useState(false)
  const [pdfReady,    setPdfReady]    = useState(false)  // first page rendered

  // Per-slot rendered data URLs.
  // Keys: String(pageNum) for portrait pages, "${pageNum}_L" / "${pageNum}_R" for landscape halves.
  const [pageUrls, setPageUrls] = useState<Record<string, string>>({})

  // UI overlays
  const [audioOn,      setAudioOn]      = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [ctrlVisible,  setCtrlVisible]  = useState(true)
  const [coverClosed,  setCoverClosed]  = useState(false)  // user hasn't opened the book yet
  const [zoomOpen,     setZoomOpen]     = useState(false)  // reading-zoom overlay
  const [zoomLevel,    setZoomLevel]    = useState(1)      // 1x–5x
  const [zoomPan,      setZoomPan]      = useState({ x: 0, y: 0 })
  const [isDraggingZoom, setIsDraggingZoom] = useState(false)
  const zoomDragRef  = useRef({ on: false, sx: 0, sy: 0, px: 0, py: 0, moved: false })
  const zoomPinchRef = useRef(0)
  const [isMobile,     setIsMobile]     = useState(false)  // smallest dimension < 600px (phone)
  const [isLandscape,  setIsLandscape]  = useState(false)  // phone rotated landscape

  const scaleRef      = useRef(1)
  const pageDims      = useRef({ w: 595, h: 842 })   // from PDF page 1
  const isSpreadPDF   = useRef(false)                  // true = each PDF page = landscape spread (2 mag pages)
  const isAllSpread   = useRef(false)                  // true = even page 1 is landscape (all pages are spreads)
  const renderingSet  = useRef(new Set<number>())
  const pageFlipRef   = useRef<any>(null)
  const containerRef  = useRef<HTMLDivElement>(null)
  const idleTimer     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartX   = useRef(0)
  const flipReady     = useRef(false)

  // ── Pre-rendered mode: skip PDF loading, use stored images directly ───
  useEffect(() => {
    if (!preRendered) return
    // Hydrate refs from the stored data (synchronous — must happen before calcScale)
    isSpreadPDF.current = preRendered.isSpreadPDF
    isAllSpread.current = preRendered.isAllSpread
    pageDims.current    = preRendered.pageDimensions
    // Batch all state updates
    setPageUrls(preRendered.slots)
    setNumPages(preRendered.totalPdfPages)
    setIsLoading(false)
    setPdfReady(true)
  // calcScale intentionally excluded: runs via the resize listener effect below
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preRendered])

  // ── Detect mobile & orientation ───────────────────────────────────────
  // Use smallest dimension so phones in landscape are still "mobile"
  useEffect(() => {
    const check = () => {
      const minDim = Math.min(window.innerWidth, window.innerHeight)
      setIsMobile(minDim < 600)
      setIsLandscape(window.innerWidth > window.innerHeight)
    }
    check()
    window.addEventListener('resize', check)
    window.addEventListener('orientationchange', check)
    return () => {
      window.removeEventListener('resize', check)
      window.removeEventListener('orientationchange', check)
    }
  }, [])

  // ── Scale ──────────────────────────────────────────────────────────────
  const calcScale = useCallback(() => {
    if (typeof window === 'undefined') return
    const { w, h } = pageDims.current
    const minDim = Math.min(window.innerWidth, window.innerHeight)
    if (minDim < 600) {
      if (window.innerWidth > window.innerHeight) {
        // Landscape phone: fit two portrait pages side by side
        const PAD_H = 10, PAD_V = 36
        const s = Math.min(
          (window.innerWidth  - PAD_H * 2) / (w * 2),
          (window.innerHeight - PAD_V)      / h
        )
        setScale(Math.max(0.2, s)); scaleRef.current = Math.max(0.2, s)
      } else {
        // Portrait phone: fit single page (leave room for top/bottom bars)
        const PAD_TOP = 52, PAD_BOT = 72
        const s = Math.min(
          (window.innerWidth  - 12) / w,
          (window.innerHeight - PAD_TOP - PAD_BOT) / h
        )
        setScale(Math.max(0.25, s)); scaleRef.current = Math.max(0.25, s)
      }
    } else {
      // Desktop: PAD_V/H ensure visible breathing room around the book (wood visible).
      // MAX_SCALE caps size on large monitors so the book never feels overwhelming.
      const BOTTOM = 36, PAD_V = 64, PAD_H = 88, MAX_SCALE = 0.72
      // w = one magazine page width (portrait). Fit two side by side.
      const s = Math.max(0.25, Math.min(
        (window.innerHeight - BOTTOM - PAD_V * 2) / h,
        (window.innerWidth  - PAD_H * 2)          / (w * 2),
        MAX_SCALE
      ))
      setScale(s); scaleRef.current = s
    }
  }, [])

  useEffect(() => {
    calcScale()
    window.addEventListener('resize', calcScale)
    return () => window.removeEventListener('resize', calcScale)
  }, [calcScale])

  // ── Reset zoom when overlay closes ────────────────────────────────────
  useEffect(() => {
    if (!zoomOpen) { setZoomLevel(1); setZoomPan({ x: 0, y: 0 }); setIsDraggingZoom(false) }
  }, [zoomOpen])

  // ── Non-passive wheel zoom on the overlay ─────────────────────────────
  useEffect(() => {
    if (!zoomOpen) return
    const el = document.getElementById('zoom-overlay-inner')
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setZoomLevel(z => {
        const next = Math.max(1, Math.min(5, z * (e.deltaY < 0 ? 1.15 : 1 / 1.15)))
        if (next <= 1) setZoomPan({ x: 0, y: 0 })
        return next
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomOpen])

  // ── Fullscreen ─────────────────────────────────────────────────────────
  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', h)
    return () => document.removeEventListener('fullscreenchange', h)
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {})
    else document.exitFullscreen().catch(() => {})
  }, [])

  // ── Controls auto-hide ─────────────────────────────────────────────────
  const resetIdle = useCallback(() => {
    setCtrlVisible(true)
    if (idleTimer.current) clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => setCtrlVisible(false), 3500)
  }, [])

  useEffect(() => {
    resetIdle()
    window.addEventListener('mousemove', resetIdle)
    window.addEventListener('touchstart', resetIdle)
    return () => {
      window.removeEventListener('mousemove', resetIdle)
      window.removeEventListener('touchstart', resetIdle)
      if (idleTimer.current) clearTimeout(idleTimer.current)
    }
  }, [resetIdle])

  // ── Track view ─────────────────────────────────────────────────────────
  useEffect(() => {
    let sid = sessionStorage.getItem('dework_session')
    if (!sid) { sid = crypto.randomUUID(); sessionStorage.setItem('dework_session', sid) }
    fetch('/api/track-view', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issueId, sessionId: sid }),
    }).catch(() => {})
  }, [issueId])

  // ── Load PDF ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (preRendered) return   // ← skip: images already loaded from DB
    setIsLoading(true); setError(null); setLoadSlow(false); setPdfReady(false)
    setPageUrls({})               // clear old PDF's images
    isSpreadPDF.current = false   // reset for incoming PDF
    isAllSpread.current = false
    const slow = setTimeout(() => setLoadSlow(true), 12000)
    const task = pdfjsLib.getDocument({
      url: pdfUrl,
      cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
      cMapPacked: true, rangeChunkSize: 65536,
      disableRange: false, disableStream: false,
    })
    task.promise.then(async doc => {
      clearTimeout(slow)
      setPdf(doc); setNumPages(doc.numPages)

      // ── Detect spread format ──────────────────────────────────────────────
      // Three possible PDF shapes:
      //   A) Portrait cover (p1) + landscape spreads (p2+) — most common
      //   B) All-landscape (every page is a spread, including p1)
      //   C) All-portrait (no spreads)
      const p1  = await doc.getPage(1)
      const vp1 = p1.getViewport({ scale: 1 })

      if (vp1.width > vp1.height * 1.1) {
        // (B) All-landscape: page 1 is itself a spread → one mag page = half width
        pageDims.current    = { w: vp1.width / 2, h: vp1.height }
        isSpreadPDF.current = true
        isAllSpread.current = true
      } else {
        // Portrait page 1 — check page 2 for spread detection
        pageDims.current = { w: vp1.width, h: vp1.height }
        if (doc.numPages >= 2) {
          const p2  = await doc.getPage(2)
          const vp2 = p2.getViewport({ scale: 1 })
          isSpreadPDF.current = vp2.width > vp2.height * 1.1  // (A)
        }
      }

      calcScale()
      setIsLoading(false)
      setLoadSlow(false)
    }).catch(() => {
      clearTimeout(slow); setError('No se pudo cargar el PDF.'); setIsLoading(false)
    })
    return () => { clearTimeout(slow); task.destroy().catch(() => {}) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfUrl, calcScale, preRendered])

  // ── Render a single PDF page → JPEG data URL ──────────────────────────
  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdf || renderingSet.current.has(pageNum)) return
    renderingSet.current.add(pageNum)
    try {
      const page     = await pdf.getPage(pageNum)
      const viewport = page.getViewport({ scale: scaleRef.current })
      const canvas   = document.createElement('canvas')
      canvas.width   = viewport.width
      canvas.height  = viewport.height
      const ctx      = canvas.getContext('2d')!
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await page.render({ canvasContext: ctx, viewport } as any).promise

      // Landscape pages (spreads) → split canvas into LEFT and RIGHT halves.
      // This avoids relying on CSS overflow:hidden which page-flip doesn't honour.
      const isLandscapePage = isSpreadPDF.current &&
        (isAllSpread.current || pageNum > 1)

      if (isLandscapePage) {
        const halfW = Math.round(canvas.width / 2)

        const left = document.createElement('canvas')
        left.width = halfW; left.height = canvas.height
        left.getContext('2d')!.drawImage(canvas, 0, 0, halfW, canvas.height, 0, 0, halfW, canvas.height)

        const right = document.createElement('canvas')
        right.width = halfW; right.height = canvas.height
        right.getContext('2d')!.drawImage(canvas, halfW, 0, halfW, canvas.height, 0, 0, halfW, canvas.height)

        setPageUrls(prev => ({
          ...prev,
          [`${pageNum}_L`]: left.toDataURL('image/jpeg', 0.82),
          [`${pageNum}_R`]: right.toDataURL('image/jpeg', 0.82),
        }))
      } else {
        setPageUrls(prev => ({ ...prev, [String(pageNum)]: canvas.toDataURL('image/jpeg', 0.82) }))
      }

      if (pageNum === 1) setPdfReady(true)
    } catch { /* cancelled */ }
    renderingSet.current.delete(pageNum)
  }, [pdf])

  // ── Render pages: priority order (cover → first 2 spreads → rest) ──────
  useEffect(() => {
    if (preRendered) return   // ← skip: all images already in pageUrls
    if (!pdf || numPages === 0) return
    // Priority: first 6 pages (cover + 2 double-page spreads)
    const priority = Math.min(6, numPages)
    for (let i = 1; i <= priority; i++) renderPage(i)
    // Remaining pages in background
    if (numPages > priority) {
      setTimeout(() => {
        for (let i = priority + 1; i <= numPages; i++) renderPage(i)
      }, 600)
    }
  }, [pdf, numPages, renderPage, preRendered])

  // ── Initialise PageFlip once container + first page are ready ─────────
  useEffect(() => {
    if (!containerRef.current || !pdfReady || flipReady.current) return
    if (numPages === 0 || !pageUrls[1]) return
    if (isMobile) return   // mobile uses custom single-page carousel

    const estW = Math.round(pageDims.current.w * scaleRef.current)
    const estH = Math.round(pageDims.current.h * scaleRef.current)

    // Dynamically import page-flip (browser only)
    import('page-flip').then(({ PageFlip }) => {
      if (!PageFlip || !containerRef.current) return

      const pf = new PageFlip(containerRef.current, {
        width:              estW,
        height:             estH,
        size:               'fixed',
        drawShadow:         true,
        flippingTime:       700,
        usePortrait:        false,   // two magazine pages side by side (open book)
        showCover:          true,    // slot 0 = cover, shown alone
        useMouseEvents:     true,
        swipeDistance:      30,
        clickEventForward:  true,
        startZIndex:        0,
        autoSize:           false,
      })

      const slots = containerRef.current.querySelectorAll('.pf-slot')
      pf.loadFromHTML(slots)

      pf.on('flip', (e: { data: number }) => {
        const pg = e.data + 1
        setCurrentPage(pg)
        if (audioOn) playPageSound()
        // Eagerly render upcoming pages
        for (let i = pg + 1; i <= Math.min(pg + 4, numPages); i++) {
          const key = isSpreadPDF.current ? `${i}_L` : String(i)
          if (!pageUrls[key]) renderPage(i)
        }
        const sid = sessionStorage.getItem('dework_session') || ''
        fetch('/api/track-page', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ issueId, sessionId: sid, pageNumber: pg }),
        }).catch(() => {})
      })

      pageFlipRef.current = pf
      flipReady.current   = true
    }).catch(console.error)

    return () => {
      pageFlipRef.current?.destroy()
      pageFlipRef.current = null
      flipReady.current   = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfReady, numPages, isMobile])   // pdfReady fires when page 1 finishes → URLs are in state

  // ── Keyboard navigation ────────────────────────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const pf = pageFlipRef.current
      if (!pf) return
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); pf.flipNext() }
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   { e.preventDefault(); pf.flipPrev() }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  // ── Touch swipe ────────────────────────────────────────────────────────
  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX }
  const onTouchEnd   = (e: React.TouchEvent) => {
    const dx = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(dx) < 45) return
    if (isMobile) {
      const step = isLandscape ? 2 : 1
      if (dx > 0) { if (currentPage < totalSlots) { setCurrentPage(p => Math.min(totalSlots, p + step)); if (audioOn) playPageSound() } }
      else         { if (currentPage > 1)          { setCurrentPage(p => Math.max(1, p - step));          if (audioOn) playPageSound() } }
    } else {
      if (!pageFlipRef.current) return
      if (dx > 0) pageFlipRef.current.flipNext()
      else        pageFlipRef.current.flipPrev()
    }
  }

  // ── Slot URL helper (used by zoom overlay) ────────────────────────────
  const getSlotUrl = (slot: number): string | null => {
    if (slot < 0) return null
    let urlKey: string
    if (isAllSpread.current) {
      const p = Math.floor(slot / 2) + 1
      urlKey = `${p}_${slot % 2 === 0 ? 'L' : 'R'}`
    } else if (!isSpreadPDF.current) {
      urlKey = String(slot + 1)
    } else if (slot === 0) {
      urlKey = '1'
    } else {
      const p = Math.floor((slot - 1) / 2) + 2
      urlKey = `${p}_${(slot - 1) % 2 === 0 ? 'L' : 'R'}`
    }
    return pageUrls[urlKey] ?? null
  }

  // ── Derived ────────────────────────────────────────────────────────────
  // estW = one magazine page width (= portrait PDF page 1 width × scale)
  // For spread PDFs: landscape pages render to 2×estW wide; we split them into L/R halves
  const estW     = Math.round(pageDims.current.w * scale) || 300
  const estH     = Math.round(pageDims.current.h * scale) || 424
  const bookW    = estW * 2   // open book = two magazine pages side by side

  // Total page-flip slots:
  //   All-portrait PDF:       1 slot per PDF page
  //   Mixed (portrait cover): slot 0 = cover  +  2 slots × (numPages-1) landscape pages
  //   All-landscape PDF:      2 slots × numPages
  const totalSlots = !isSpreadPDF.current
    ? numPages
    : isAllSpread.current
      ? numPages * 2
      : 1 + (numPages - 1) * 2
  const progress = totalSlots > 1 ? ((currentPage - 1) / (totalSlots - 1)) * 100 : 0

  const iconBtn: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer', padding: 6,
    color: 'rgba(0,0,0,0.38)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  }

  if (error) {
    return (
      <div className="flex items-center justify-center" style={{ height: '100vh', ...READER_BG }}>
        <div className="text-center space-y-4 px-6">
          <p className="text-sm" style={{ color: 'rgba(0,0,0,0.45)' }}>{error}</p>
          <button onClick={() => window.location.reload()} className="text-[11px] tracking-widest uppercase border-b" style={{ color: 'rgba(0,0,0,0.4)', borderColor: 'rgba(0,0,0,0.2)' }}>
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{ height: '100vh', overflow: 'hidden', ...READER_BG, display: 'flex', flexDirection: 'column', userSelect: 'none' }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* ── Main viewport ── */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>

        {/* Back button — top-left */}
        <div style={{ position: 'absolute', top: 14, left: 16, zIndex: 30, opacity: ctrlVisible ? 1 : 0, transition: 'opacity 0.5s', pointerEvents: ctrlVisible ? 'auto' : 'none' }}>
          <Link href={backUrl} style={{ ...iconBtn, gap: 5, textDecoration: 'none', color: 'rgba(0,0,0,0.40)', display: 'flex', alignItems: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
            <span className="hidden sm:inline text-[10px] tracking-[0.2em] uppercase">Volver</span>
          </Link>
        </div>

        {/* Title — top-center, always visible */}
        {(publicationName || issueTitle) && (
          <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 30,
            height: 52, display: 'flex', alignItems: 'center', pointerEvents: 'none',
            maxWidth: 'calc(100% - 260px)', overflow: 'hidden' }}>
            <span style={{ fontSize: 20, color: 'rgba(0,0,0,0.85)', letterSpacing: '0.08em',
              textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              fontWeight: 700 }}>
              {publicationName}{publicationName && issueTitle ? ' · ' : ''}{issueTitle}
            </span>
          </div>
        )}

        {/* Top-right: zoom + audio + fullscreen */}
        <div style={{ position: 'absolute', top: 10, right: 14, zIndex: 30, display: 'flex', gap: 2, opacity: ctrlVisible ? 1 : 0, transition: 'opacity 0.5s', pointerEvents: ctrlVisible ? 'auto' : 'none' }}>
          {/* Zoom / reading mode */}
          {coverClosed && (
            <button onClick={() => setZoomOpen(true)} style={iconBtn} title="Zoom para leer">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
              </svg>
            </button>
          )}
          <button onClick={() => setAudioOn(a => !a)} style={{ ...iconBtn, color: audioOn ? 'rgba(0,0,0,0.42)' : 'rgba(0,0,0,0.18)' }}>
            {audioOn
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
            }
          </button>
          <button onClick={toggleFullscreen} style={iconBtn}>
            {isFullscreen
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
            }
          </button>
        </div>

        {/* Download — bottom-right */}
        {downloadUrl && (
          <div style={{ position: 'absolute', bottom: 10, right: 14, zIndex: 30, opacity: ctrlVisible ? 1 : 0, transition: 'opacity 0.5s', pointerEvents: ctrlVisible ? 'auto' : 'none' }}>
            <a href={downloadUrl} download style={{ ...iconBtn, color: 'rgba(0,0,0,0.35)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
            </a>
          </div>
        )}

        {/* ── Cover screen: single page, shown until user opens the book ── */}
        {!coverClosed && (
          <div
            style={{
              position: 'absolute', inset: 0, zIndex: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: pdfReady ? 'pointer' : 'default',
            }}
            onClick={pdfReady ? () => { setCoverClosed(true); requestAnimationFrame(() => pageFlipRef.current?.flipNext()) } : undefined}
          >
            <div style={{ padding: 3, background: 'linear-gradient(145deg, #E8C040, #C8921A, #A87010, #D4A830)', boxShadow: '0 6px 36px rgba(0,0,0,0.22)' }}>
              <div style={{ position: 'relative', width: estW, height: estH, overflow: 'hidden' }}>
                {/* Cover image (or gradient fallback) */}
                {coverUrl
                  ? /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={coverUrl} alt="Portada" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #E8E4DF 20%, #D8D4CC 80%)' }} />
                }
                {/* Loading indicator */}
                {!pdfReady && (
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 55%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 24 }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[0, 140, 280].map(d => (
                        <div key={d} className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: `${d}ms`, opacity: 0.85 }} />
                      ))}
                    </div>
                    {loadSlow && <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: 11, marginTop: 8, textAlign: 'center', lineHeight: 1.6 }}>Edición en alta resolución.<br/>Un momento…</p>}
                  </div>
                )}
                {/* "Tap to open" hint once ready */}
                {pdfReady && (
                  <div style={{ position: 'absolute', bottom: 14, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
                    <span style={{ fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.88)', background: 'rgba(0,0,0,0.28)', padding: '4px 14px', borderRadius: 20 }}>
                      Tocar para abrir
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Mobile reader (portrait = single page, landscape = double spread) ── */}
        {isMobile && coverClosed && pdfReady && (() => {
          const goNext = () => { if (currentPage < totalSlots) { setCurrentPage(p => Math.min(totalSlots, p + (isLandscape ? 2 : 1))); if (audioOn) playPageSound() } }
          const goPrev = () => { if (currentPage > 1)          { setCurrentPage(p => Math.max(1,           p - (isLandscape ? 2 : 1))); if (audioOn) playPageSound() } }
          const canNext = currentPage < totalSlots
          const canPrev = currentPage > 1

          if (isLandscape) {
            /* ── Landscape: two pages side by side ─────────────────────── */
            const leftUrl  = getSlotUrl(currentPage - 1)
            const rightUrl = currentPage < totalSlots ? getSlotUrl(currentPage) : null
            return (
              <div style={{ position: 'absolute', inset: 0, zIndex: 5,
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {/* Pages */}
                <div style={{ display: 'flex', gap: 3, height: 'calc(100% - 28px)',
                  padding: '4px 52px', alignItems: 'center', justifyContent: 'center' }}>
                  {leftUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={leftUrl} alt="Página izquierda" style={{ height: '100%', width: 'auto',
                      objectFit: 'contain', boxShadow: '0 3px 16px rgba(0,0,0,0.20)', border: '2px solid #D4A830' }} />
                  )}
                  {rightUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={rightUrl} alt="Página derecha" style={{ height: '100%', width: 'auto',
                      objectFit: 'contain', boxShadow: '0 3px 16px rgba(0,0,0,0.20)', border: '2px solid #D4A830' }} />
                  )}
                </div>
                {/* Left tap zone */}
                <div onClick={goPrev} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 52,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: canPrev ? 'pointer' : 'default', zIndex: 6 }}>
                  {canPrev && (
                    <div style={{ background: 'rgba(0,0,0,0.13)', borderRadius: '50%', width: 34, height: 34,
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="rgba(0,0,0,0.55)"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
                    </div>
                  )}
                </div>
                {/* Right tap zone */}
                <div onClick={goNext} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 52,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: canNext ? 'pointer' : 'default', zIndex: 6 }}>
                  {canNext && (
                    <div style={{ background: 'rgba(0,0,0,0.13)', borderRadius: '50%', width: 34, height: 34,
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="rgba(0,0,0,0.55)"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
                    </div>
                  )}
                </div>
              </div>
            )
          } else {
            /* ── Portrait: single page, full-width invisible tap zones ─── */
            const slotUrl = getSlotUrl(currentPage - 1)
            return (
              <div style={{ position: 'absolute', inset: 0, zIndex: 5 }}>
                {/* Page fills space between bars */}
                <div style={{ position: 'absolute', inset: 0, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', padding: '52px 6px 56px' }}>
                  {slotUrl
                    ? /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={slotUrl} alt={`Página ${currentPage}`}
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain',
                          boxShadow: '0 6px 32px rgba(0,0,0,0.22)', border: '2px solid #D4A830' }} />
                    : <div style={{ color: '#aaa', fontSize: 13 }}>Cargando…</div>
                  }
                </div>

                {/* ← invisible left half = tap to go back */}
                <div onClick={goPrev}
                  style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '44%', zIndex: 6,
                    display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
                    paddingLeft: 10, cursor: canPrev ? 'pointer' : 'default' }}>
                  {canPrev && (
                    <div style={{ background: 'rgba(0,0,0,0.14)', borderRadius: '50%',
                      width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="rgba(0,0,0,0.55)"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
                    </div>
                  )}
                </div>

                {/* → invisible right half = tap to go forward */}
                <div onClick={goNext}
                  style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '44%', zIndex: 6,
                    display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                    paddingRight: 10, cursor: canNext ? 'pointer' : 'default' }}>
                  {canNext && (
                    <div style={{ background: 'rgba(0,0,0,0.14)', borderRadius: '50%',
                      width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="rgba(0,0,0,0.55)"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
                    </div>
                  )}
                </div>

                {/* Page counter + first-time hint */}
                <div style={{ position: 'absolute', bottom: 6, left: 0, right: 0, zIndex: 7, pointerEvents: 'none',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  {currentPage <= 2 && (
                    <span style={{ fontSize: 9, color: 'rgba(0,0,0,0.28)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                      tocá los bordes o deslizá para pasar
                    </span>
                  )}
                  <span style={{ fontSize: 10, color: 'rgba(0,0,0,0.32)', letterSpacing: '0.22em' }}>
                    {currentPage} / {totalSlots}
                  </span>
                </div>
              </div>
            )
          }
        })()}

        {/* ── Side navigation arrows (show when book is open — desktop only) ── */}
        {!isMobile && coverClosed && (
          <>
            <button
              onClick={() => pageFlipRef.current?.flipPrev()}
              style={{
                position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                zIndex: 10, background: 'none', border: 'none', cursor: 'pointer', padding: '10px 6px',
                color: 'rgba(0,0,0,0.22)', opacity: ctrlVisible ? 1 : 0,
                transition: 'opacity 0.5s', pointerEvents: ctrlVisible ? 'auto' : 'none',
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
              </svg>
            </button>
            <button
              onClick={() => pageFlipRef.current?.flipNext()}
              style={{
                position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                zIndex: 10, background: 'none', border: 'none', cursor: 'pointer', padding: '10px 6px',
                color: 'rgba(0,0,0,0.22)', opacity: ctrlVisible ? 1 : 0,
                transition: 'opacity 0.5s', pointerEvents: ctrlVisible ? 'auto' : 'none',
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
              </svg>
            </button>
          </>
        )}

        {/* ── Gold border + PageFlip container (desktop only) ── */}
        <div style={{
          padding: 3,
          background: 'linear-gradient(145deg, #E8C040 0%, #C8921A 35%, #A87010 60%, #D4A830 100%)',
          boxShadow: '0 12px 64px rgba(0,0,0,0.34), 0 4px 18px rgba(0,0,0,0.20), 0 1px 4px rgba(0,0,0,0.12)',
          // Hidden behind cover overlay until book opens; completely gone on mobile
          visibility: (!isMobile && pdfReady && coverClosed) ? 'visible' : 'hidden',
          display: isMobile ? 'none' : undefined,
          zIndex: 2,
        }}>
          {/*
            IMPORTANT: this div is the PageFlip target.
            - position:relative + overflow:hidden are required by PageFlip
            - The .pf-slot divs inside are the page "slides"
            - PageFlip repositions them absolutely and renders the curl on its own canvas
          */}
          <div
            ref={containerRef}
            style={{
              position: 'relative',
              width:    bookW,
              height:   estH,
              overflow: 'hidden',
            }}
          >
            {Array.from({ length: totalSlots }, (_, i) => {
              /*
                Each slot is exactly estW x estH — one magazine page.
                Images are pre-cropped JPEGs (split at canvas render time).
                No CSS overflow tricks needed.

                URL key scheme:
                  Portrait page  → String(pageNum)          e.g. "1"
                  Landscape left  → "${pageNum}_L"           e.g. "2_L"
                  Landscape right → "${pageNum}_R"           e.g. "2_R"

                Slot-to-key mapping:
                  (C) All-portrait:           key = String(i+1)
                  (A) Portrait cover+spreads: i=0 → "1" | i>0 → pdfPage_L/R
                  (B) All-landscape:          all → pdfPage_L/R
              */
              let urlKey: string
              if (isAllSpread.current) {
                const pdfPage = Math.floor(i / 2) + 1
                urlKey = `${pdfPage}_${i % 2 === 0 ? 'L' : 'R'}`
              } else if (!isSpreadPDF.current) {
                urlKey = String(i + 1)
              } else if (i === 0) {
                urlKey = '1'
              } else {
                const pdfPage = Math.floor((i - 1) / 2) + 2
                urlKey = `${pdfPage}_${(i - 1) % 2 === 0 ? 'L' : 'R'}`
              }

              const url = pageUrls[urlKey]

              return (
                <div
                  key={i}
                  className="pf-slot"
                  style={{ width: estW, height: estH, background: '#FEFDFB', flexShrink: 0, overflow: 'hidden' }}
                >
                  {url
                    ? /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={url}
                        alt={`Slot ${i + 1}`}
                        style={{ width: estW, height: estH, display: 'block', objectFit: 'fill' }}
                      />
                    : <div style={{ width: estW, height: estH, background: '#FAFAF8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: '#ddd', fontSize: Math.round(estH * 0.12), fontStyle: 'italic' }}>{i + 1}</span>
                      </div>
                  }
                </div>
              )
            })}
          </div>
        </div>

      </div>{/* end main viewport */}

      {/* ── Reading-zoom overlay ─────────────────────────────────────────── */}
      {zoomOpen && (() => {
        // Portrait mobile: single page centred. Landscape mobile + desktop: left + right spread.
        const leftUrl  = getSlotUrl(currentPage - 1)
        const rightUrl = (isMobile && !isLandscape) ? null : getSlotUrl(currentPage)
        const zBtnStyle: React.CSSProperties = {
          background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.28)',
          borderRadius: 8, cursor: 'pointer', color: 'white', width: 40, height: 40,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 300,
        }
        return (
          <div
            id="zoom-overlay-inner"
            style={{
              position: 'fixed', inset: 0, zIndex: 200,
              background: 'rgba(0,0,0,0.93)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: isDraggingZoom ? 'grabbing' : zoomLevel > 1 ? 'grab' : 'default',
              userSelect: 'none', WebkitUserSelect: 'none',
              overflow: 'hidden',
            }}
            onClick={() => { if (!zoomDragRef.current.moved) setZoomOpen(false) }}
            onMouseDown={e => {
              zoomDragRef.current = { on: true, moved: false, sx: e.clientX, sy: e.clientY, px: zoomPan.x, py: zoomPan.y }
              setIsDraggingZoom(true)
            }}
            onMouseMove={e => {
              if (!zoomDragRef.current.on) return
              const dx = e.clientX - zoomDragRef.current.sx
              const dy = e.clientY - zoomDragRef.current.sy
              if (Math.abs(dx) + Math.abs(dy) > 4) zoomDragRef.current.moved = true
              setZoomPan({ x: zoomDragRef.current.px + dx, y: zoomDragRef.current.py + dy })
            }}
            onMouseUp={() => { zoomDragRef.current.on = false; setIsDraggingZoom(false) }}
            onMouseLeave={() => { zoomDragRef.current.on = false; setIsDraggingZoom(false) }}
            onTouchStart={e => {
              if (e.touches.length === 2) {
                const dx = e.touches[1].clientX - e.touches[0].clientX
                const dy = e.touches[1].clientY - e.touches[0].clientY
                zoomPinchRef.current = Math.sqrt(dx * dx + dy * dy)
              } else {
                zoomDragRef.current = { on: true, moved: false, sx: e.touches[0].clientX, sy: e.touches[0].clientY, px: zoomPan.x, py: zoomPan.y }
              }
            }}
            onTouchMove={e => {
              if (e.touches.length === 2) {
                const dx = e.touches[1].clientX - e.touches[0].clientX
                const dy = e.touches[1].clientY - e.touches[0].clientY
                const dist = Math.sqrt(dx * dx + dy * dy)
                const factor = dist / (zoomPinchRef.current || dist)
                zoomPinchRef.current = dist
                setZoomLevel(z => Math.max(1, Math.min(5, z * factor)))
              } else if (zoomDragRef.current.on) {
                const ddx = e.touches[0].clientX - zoomDragRef.current.sx
                const ddy = e.touches[0].clientY - zoomDragRef.current.sy
                zoomDragRef.current.moved = true
                setZoomPan({ x: zoomDragRef.current.px + ddx, y: zoomDragRef.current.py + ddy })
              }
            }}
            onTouchEnd={() => { zoomDragRef.current.on = false }}
          >
            {/* Pages with zoom transform */}
            <div
              style={{
                display: 'flex', gap: 2,
                transform: `scale(${zoomLevel}) translate(${zoomPan.x / zoomLevel}px, ${zoomPan.y / zoomLevel}px)`,
                transformOrigin: 'center center',
                transition: isDraggingZoom ? 'none' : 'transform 0.12s ease',
                willChange: 'transform',
              }}
              onClick={e => e.stopPropagation()}
            >
              {leftUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={leftUrl} alt="Página izquierda" draggable={false}
                  style={{ height: 'calc(100vh - 80px)', width: 'auto', display: 'block',
                    boxShadow: '0 4px 32px rgba(0,0,0,0.6)', pointerEvents: 'none' }} />
              )}
              {rightUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={rightUrl} alt="Página derecha" draggable={false}
                  style={{ height: 'calc(100vh - 80px)', width: 'auto', display: 'block',
                    boxShadow: '0 4px 32px rgba(0,0,0,0.6)', pointerEvents: 'none' }} />
              )}
            </div>

            {/* Zoom controls bar */}
            <div
              style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
                display: 'flex', alignItems: 'center', gap: 8, zIndex: 201,
                background: 'rgba(0,0,0,0.5)', borderRadius: 12, padding: '6px 12px',
                backdropFilter: 'blur(8px)',
              }}
              onClick={e => e.stopPropagation()}
            >
              <button style={zBtnStyle} title="Alejar"
                onClick={e => { e.stopPropagation(); setZoomLevel(z => { const nz = Math.max(1, z / 1.35); if (nz <= 1) setZoomPan({ x: 0, y: 0 }); return nz }) }}>
                −
              </button>
              <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, minWidth: 44, textAlign: 'center', letterSpacing: '0.05em' }}>
                {Math.round(zoomLevel * 100)}%
              </span>
              <button style={zBtnStyle} title="Acercar"
                onClick={e => { e.stopPropagation(); setZoomLevel(z => Math.min(5, z * 1.35)) }}>
                +
              </button>
              {zoomLevel > 1 && (
                <button style={{ ...zBtnStyle, fontSize: 11, width: 'auto', padding: '0 10px', marginLeft: 4 }} title="Restablecer zoom"
                  onClick={e => { e.stopPropagation(); setZoomLevel(1); setZoomPan({ x: 0, y: 0 }) }}>
                  1:1
                </button>
              )}
            </div>

            {/* Close */}
            <button
              onClick={e => { e.stopPropagation(); setZoomOpen(false) }}
              style={{ position: 'fixed', top: 14, right: 16, zIndex: 201,
                background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: '50%', width: 38, height: 38, cursor: 'pointer',
                color: 'white', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>✕</button>

            {/* Prev / Next */}
            <button
              onClick={e => {
                e.stopPropagation()
                if (isMobile) { const step = isLandscape ? 2 : 1; if (currentPage > 1) { setCurrentPage(p => Math.max(1, p - step)); if (audioOn) playPageSound() } }
                else pageFlipRef.current?.flipPrev()
                setZoomLevel(1); setZoomPan({ x: 0, y: 0 })
              }}
              style={{ position: 'fixed', left: 12, top: '50%', transform: 'translateY(-50%)', zIndex: 201,
                background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 6, cursor: 'pointer',
                color: 'white', padding: '12px 8px', display: 'flex', alignItems: 'center' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
            </button>
            <button
              onClick={e => {
                e.stopPropagation()
                if (isMobile) { const step = isLandscape ? 2 : 1; if (currentPage < totalSlots) { setCurrentPage(p => Math.min(totalSlots, p + step)); if (audioOn) playPageSound() } }
                else pageFlipRef.current?.flipNext()
                setZoomLevel(1); setZoomPan({ x: 0, y: 0 })
              }}
              style={{ position: 'fixed', right: 12, top: '50%', transform: 'translateY(-50%)', zIndex: 201,
                background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 6, cursor: 'pointer',
                color: 'white', padding: '12px 8px', display: 'flex', alignItems: 'center' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
            </button>

            {/* Hint */}
            {zoomLevel === 1 && (
              <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
                color: 'rgba(255,255,255,0.45)', fontSize: 11, letterSpacing: '0.08em', pointerEvents: 'none',
                whiteSpace: 'nowrap' }}>
                {isMobile ? 'pellizca para acercar · arrastrá para mover' : 'scroll para hacer zoom · arrastrá para mover'}
              </div>
            )}
          </div>
        )
      })()}

      {/* ── Bottom: progress bar + page counter ── */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ height: 3, background: 'rgba(0,0,0,0.10)' }}>
          <div style={{ height: '100%', background: `linear-gradient(90deg, ${GOLD}, #E8C050)`, width: `${progress}%`, transition: 'width 0.55s ease' }} />
        </div>
        <div style={{ height: 33, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(240,237,232,0.97)', borderTop: '1px solid rgba(0,0,0,0.07)' }}>
          {!isLoading && numPages > 0 && (
            <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.38)', letterSpacing: '0.28em', textTransform: 'uppercase' }}>
              {currentPage}&thinsp;/&thinsp;{totalSlots}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
