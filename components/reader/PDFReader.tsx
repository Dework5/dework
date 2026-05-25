'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

interface PDFReaderProps {
  pdfUrl:      string
  issueId:     string
  totalPages?: number
  coverUrl?:   string
}

// ── Sound ─────────────────────────────────────────────────────────────────
function playPageSound() {
  try {
    const ctx  = new AudioContext()
    const sr   = ctx.sampleRate
    const dur  = 0.10
    const len  = Math.floor(sr * dur)
    const buf  = ctx.createBuffer(1, len, sr)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) {
      const t   = i / len
      const env = Math.pow(1 - t, 2.5) * (1 + Math.sin(t * Math.PI * 2) * 0.12)
      data[i]   = (Math.random() * 2 - 1) * env * 0.36
    }
    const src  = ctx.createBufferSource()
    src.buffer = buf
    const bpf  = ctx.createBiquadFilter()
    bpf.type   = 'bandpass'; bpf.frequency.value = 3200; bpf.Q.value = 0.75
    const gain = ctx.createGain(); gain.gain.value = 0.60
    src.connect(bpf); bpf.connect(gain); gain.connect(ctx.destination)
    src.start()
    src.onended = () => ctx.close().catch(() => {})
  } catch { /* silent */ }
}

// ── SVG Icons ─────────────────────────────────────────────────────────────
function IconSoundOn()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg> }
function IconSoundOff() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg> }
function IconExpand()   { return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg> }
function IconCompress() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg> }

const GOLD = '#C8961E'

// ── Flip phases ───────────────────────────────────────────────────────────
type FlipPhase = 'idle' | 'dragging' | 'completing' | 'springing'

export function PDFReader({ pdfUrl, issueId, totalPages, coverUrl }: PDFReaderProps) {
  // ── PDF state ──────────────────────────────────────────────────────────
  const [pdf,          setPdf]          = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [numPages,     setNumPages]     = useState(totalPages || 0)
  const [currentPage,  setCurrentPage]  = useState(1)
  const [scale,        setScale]        = useState(1)
  const [isLoading,    setIsLoading]    = useState(true)
  const [pdfPageReady, setPdfPageReady] = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [loadSlow,     setLoadSlow]     = useState(false)

  // ── UI state ───────────────────────────────────────────────────────────
  const [audioOn,      setAudioOn]      = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [ctrlVisible,  setCtrlVisible]  = useState(true)

  // ── Flip state ─────────────────────────────────────────────────────────
  const [flipPhase,     setFlipPhase]     = useState<FlipPhase>('idle')
  const [flipDir,       setFlipDir]       = useState<'fwd' | 'bwd'>('fwd')
  const [flipAngle,     setFlipAngle]     = useState(0)      // degrees: 0 → -180 (fwd) or 0 → +180 (bwd)
  const [transDuration, setTransDuration] = useState(0)      // ms, 0 = no transition (while dragging)

  // ── Refs ───────────────────────────────────────────────────────────────
  const canvasFrontRef  = useRef<HTMLCanvasElement>(null)
  const canvasBackRef   = useRef<HTMLCanvasElement>(null)
  const renderTaskFront = useRef<pdfjsLib.RenderTask | null>(null)
  const renderTaskBack  = useRef<pdfjsLib.RenderTask | null>(null)
  const scaleRef        = useRef(1)
  const pageDims        = useRef({ w: 595, h: 842 })
  const skipRerender    = useRef(false)
  const destPageRef     = useRef(0)
  const dragStartX      = useRef(0)
  const flipAngleRef    = useRef(0)    // sync ref so pointer handlers don't stale-close
  const touchStartX     = useRef(0)
  const idleTimer       = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Scale ──────────────────────────────────────────────────────────────
  const calcScale = useCallback(() => {
    if (typeof window === 'undefined') return
    const BOTTOM = 36, PAD_V = 16, PAD_H = 20
    const availH = window.innerHeight - BOTTOM - PAD_V * 2
    const availW = window.innerWidth  - PAD_H * 2
    const { w, h } = pageDims.current
    const s = Math.max(0.3, Math.min(availH / h, availW / w, 3))
    setScale(s)
    scaleRef.current = s
  }, [])

  useEffect(() => {
    calcScale()
    window.addEventListener('resize', calcScale)
    return () => window.removeEventListener('resize', calcScale)
  }, [calcScale])

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
    setIsLoading(true); setError(null); setLoadSlow(false); setPdfPageReady(false)
    const slowTimer = setTimeout(() => setLoadSlow(true), 12000)
    const task = pdfjsLib.getDocument({
      url: pdfUrl,
      cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
      cMapPacked: true, rangeChunkSize: 65536, disableRange: false, disableStream: false,
    })
    task.promise
      .then(async doc => {
        clearTimeout(slowTimer); setPdf(doc); setNumPages(doc.numPages)
        const p1 = await doc.getPage(1); const vp = p1.getViewport({ scale: 1 })
        pageDims.current = { w: vp.width, h: vp.height }; calcScale()
        setIsLoading(false); setLoadSlow(false)
      })
      .catch(() => {
        clearTimeout(slowTimer); setError('No se pudo cargar el PDF.'); setIsLoading(false)
      })
    return () => { clearTimeout(slowTimer); task.destroy().catch(() => {}) }
  }, [pdfUrl, calcScale])

  // ── Render page to canvas ──────────────────────────────────────────────
  const renderToCanvas = useCallback(async (
    pageNum: number, s: number,
    canvas: HTMLCanvasElement | null,
    taskRef: React.MutableRefObject<pdfjsLib.RenderTask | null>
  ) => {
    if (!pdf || !canvas) return
    taskRef.current?.cancel()
    try {
      const page     = await pdf.getPage(pageNum)
      const viewport = page.getViewport({ scale: s })
      const ctx      = canvas.getContext('2d')
      if (!ctx) return
      canvas.height  = viewport.height; canvas.width = viewport.width
      const t = page.render({ canvasContext: ctx, viewport, canvas })
      taskRef.current = t
      await t.promise
    } catch (e: unknown) {
      if ((e as { name?: string })?.name !== 'RenderingCancelledException') console.error(e)
    }
  }, [pdf])

  // ── Initial render (idle phase only) ──────────────────────────────────
  useEffect(() => {
    if (!pdf || flipPhase !== 'idle') return
    if (skipRerender.current) { skipRerender.current = false; return }
    renderToCanvas(currentPage, scale, canvasFrontRef.current, renderTaskFront)
      .then(() => setPdfPageReady(true))
  }, [pdf, currentPage, scale, flipPhase, renderToCanvas])

  // ── Swap pages when CSS transition ends ───────────────────────────────
  const handleTransitionEnd = useCallback(() => {
    if (flipPhase === 'completing') {
      // Copy back canvas onto front canvas
      const front = canvasFrontRef.current
      const back  = canvasBackRef.current
      if (front && back) {
        front.width = back.width; front.height = back.height
        front.getContext('2d')?.drawImage(back, 0, 0)
      }
      skipRerender.current = true
      setCurrentPage(destPageRef.current)
      if (audioOn) playPageSound()
      // Reset angle instantly (no transition)
      setTransDuration(0)
      setFlipAngle(0)
      setFlipPhase('idle')

      const sid = sessionStorage.getItem('dework_session') || ''
      fetch('/api/track-page', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId, sessionId: sid, pageNumber: destPageRef.current }),
      }).catch(() => {})
    } else if (flipPhase === 'springing') {
      setFlipPhase('idle')
    }
  }, [flipPhase, audioOn, issueId])

  // ── Helpers ────────────────────────────────────────────────────────────
  const completeFlip = useCallback(() => {
    setTransDuration(620)
    setFlipAngle(flipDir === 'fwd' ? -180 : 180)
    setFlipPhase('completing')
  }, [flipDir])

  const springBack = useCallback(() => {
    setTransDuration(320)
    setFlipAngle(0)
    setFlipPhase('springing')
  }, [])

  // ── Pointer handlers (unified — attached to the magazine frame) ────────
  const estW = Math.round(pageDims.current.w * scale) || 300
  const estH = Math.round(pageDims.current.h * scale) || 424

  const onFramePointerDown = useCallback((e: React.PointerEvent) => {
    if (flipPhase !== 'idle' || isLoading || !pdf) return
    const bounds = e.currentTarget.getBoundingClientRect()
    const relX   = e.clientX - bounds.left
    const dir: 'fwd' | 'bwd' = relX > bounds.width / 2 ? 'fwd' : 'bwd'
    const dest = dir === 'fwd' ? currentPage + 1 : currentPage - 1
    if (dest < 1 || dest > numPages) return

    // Capture all future pointer events on this element
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)

    destPageRef.current  = dest
    dragStartX.current   = e.clientX
    flipAngleRef.current = 0

    setFlipDir(dir)
    setTransDuration(0)
    setFlipAngle(0)
    setFlipPhase('dragging')

    // Pre-render destination asynchronously while user drags
    renderToCanvas(dest, scaleRef.current, canvasBackRef.current, renderTaskBack)
  }, [flipPhase, isLoading, pdf, currentPage, numPages, renderToCanvas])

  const onFramePointerMove = useCallback((e: React.PointerEvent) => {
    if (flipPhase !== 'dragging') return
    const dx    = e.clientX - dragStartX.current
    const angle = (dx / estW) * 180
    const clamped = flipDir === 'fwd'
      ? Math.min(0,    Math.max(-180, angle))
      : Math.max(0,    Math.min( 180, angle))
    flipAngleRef.current = clamped
    setFlipAngle(clamped)
  }, [flipPhase, flipDir, estW])

  const onFramePointerUp = useCallback(() => {
    if (flipPhase !== 'dragging') return
    const angle = flipAngleRef.current
    const THRESHOLD = 55 // degrees — past this, snap to complete
    const tiny      = Math.abs(angle) < 4 // treated as a click, not a drag

    if (tiny || (flipDir === 'fwd' ? angle < -THRESHOLD : angle > THRESHOLD)) {
      completeFlip()
    } else {
      springBack()
    }
  }, [flipPhase, flipDir, completeFlip, springBack])

  // ── Keyboard ───────────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (flipPhase !== 'idle' || isLoading || !pdf) return
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        if (currentPage >= numPages) return
        destPageRef.current = currentPage + 1
        setFlipDir('fwd')
        renderToCanvas(currentPage + 1, scaleRef.current, canvasBackRef.current, renderTaskBack)
          .then(() => { setTransDuration(620); setFlipAngle(-180); setFlipPhase('completing') })
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        if (currentPage <= 1) return
        destPageRef.current = currentPage - 1
        setFlipDir('bwd')
        renderToCanvas(currentPage - 1, scaleRef.current, canvasBackRef.current, renderTaskBack)
          .then(() => { setTransDuration(620); setFlipAngle(180); setFlipPhase('completing') })
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [flipPhase, isLoading, pdf, currentPage, numPages, renderToCanvas])

  // ── Touch swipe (simple swipe — drag handled via pointer events) ───────
  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX }
  const onTouchEnd   = (e: React.TouchEvent) => {
    if (flipPhase !== 'idle' || isLoading || !pdf) return
    const dx = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(dx) < 45) return
    const dir: 'fwd' | 'bwd' = dx > 0 ? 'fwd' : 'bwd'
    const dest = dir === 'fwd' ? currentPage + 1 : currentPage - 1
    if (dest < 1 || dest > numPages) return
    destPageRef.current = dest
    setFlipDir(dir)
    renderToCanvas(dest, scaleRef.current, canvasBackRef.current, renderTaskBack)
      .then(() => { setTransDuration(620); setFlipAngle(dir === 'fwd' ? -180 : 180); setFlipPhase('completing') })
  }

  // ── Derived ────────────────────────────────────────────────────────────
  const progress    = numPages > 1 ? ((currentPage - 1) / (numPages - 1)) * 100 : 0
  const isFlipActive = flipPhase !== 'idle'
  const flipOrigin   = flipDir === 'fwd' ? 'left center' : 'right center'
  const absAngle     = Math.abs(flipAngle)
  // Shadow on the back page: light at start of flip, peaks at 90°, fades at 180°
  const backShadow   = isFlipActive ? Math.sin((absAngle / 180) * Math.PI) * 0.55 : 0
  // Shadow on front page edge (toward spine): subtle depth
  const spineShadow  = isFlipActive
    ? `linear-gradient(${flipDir === 'fwd' ? 'to left' : 'to right'}, rgba(0,0,0,${(1 - absAngle / 180) * 0.18}) 0%, transparent 30%)`
    : 'none'

  // ── Error ──────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex items-center justify-center" style={{ height: '100vh', background: '#F0EDE6' }}>
        <div className="text-center space-y-4 px-6">
          <p className="text-gray-500 text-sm">{error}</p>
          <button onClick={() => window.location.reload()} className="text-[11px] tracking-widest uppercase border-b border-gray-400 hover:text-gray-900 transition-colors">
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div
      style={{ height: '100vh', overflow: 'hidden', background: '#EDEAE3', display: 'flex', flexDirection: 'column', userSelect: 'none' }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* ── Main viewport ── */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>

        {/* Top-right floating controls */}
        <div style={{
          position: 'absolute', top: 14, right: 16, zIndex: 30,
          display: 'flex', gap: 8,
          opacity: ctrlVisible ? 1 : 0,
          transition: 'opacity 0.5s ease',
          pointerEvents: ctrlVisible ? 'auto' : 'none',
        }}>
          <button onClick={() => setAudioOn(a => !a)} title={audioOn ? 'Silenciar' : 'Activar sonido'}
            className="flex items-center justify-center"
            style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(30,25,20,0.50)', backdropFilter: 'blur(6px)', border: 'none', cursor: 'pointer', color: audioOn ? '#fff' : 'rgba(255,255,255,0.35)' }}>
            {audioOn ? <IconSoundOn /> : <IconSoundOff />}
          </button>
          <button onClick={toggleFullscreen} title={isFullscreen ? 'Salir' : 'Pantalla completa'}
            className="flex items-center justify-center"
            style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(30,25,20,0.50)', backdropFilter: 'blur(6px)', border: 'none', cursor: 'pointer', color: '#fff' }}>
            {isFullscreen ? <IconCompress /> : <IconExpand />}
          </button>
        </div>

        {/* ── Magazine frame ── */}
        <div style={{ position: 'relative', zIndex: 2 }}>
          {/* Gold gradient border */}
          <div style={{
            padding: 3,
            background: 'linear-gradient(145deg, #E8C040 0%, #C8921A 35%, #A87010 60%, #D4A830 100%)',
            boxShadow: '0 6px 36px rgba(0,0,0,0.20), 0 2px 10px rgba(0,0,0,0.14)',
          }}>
            {/* Page area — perspective applied here */}
            <div
              style={{
                position: 'relative',
                width: estW,
                minHeight: isLoading ? estH : undefined,
                background: '#FEFDFB',
                overflow: 'hidden',
                perspective: `${estW * 4}px`,
                perspectiveOrigin: 'center center',
                cursor: !isLoading && !isFlipActive ? (flipPhase === 'idle' ? 'pointer' : 'grabbing') : 'default',
              }}
              onPointerDown={onFramePointerDown}
              onPointerMove={onFramePointerMove}
              onPointerUp={onFramePointerUp}
              onPointerCancel={onFramePointerUp}
            >

              {/* BACK canvas — destination page, revealed as front rotates away */}
              <div style={{
                position: 'absolute', inset: 0, zIndex: 0,
                opacity: isFlipActive ? 1 : 0,
                pointerEvents: 'none',
              }}>
                <canvas ref={canvasBackRef} style={{ display: 'block' }} />
                {/* Shadow overlay on back page (depth during flip) */}
                {isFlipActive && (
                  <div style={{
                    position: 'absolute', inset: 0, pointerEvents: 'none',
                    background: `rgba(0,0,0,${backShadow})`,
                  }} />
                )}
              </div>

              {/* FRONT canvas — current page, rotates in 3D */}
              <div style={{
                position: isFlipActive ? 'absolute' : 'relative',
                inset: 0, zIndex: 1,
                transformStyle: 'preserve-3d',
                transformOrigin: flipOrigin,
                transform: `rotateY(${flipAngle}deg)`,
                transition: transDuration > 0
                  ? `transform ${transDuration}ms cubic-bezier(0.645, 0.045, 0.355, 1.000)`
                  : 'none',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                pointerEvents: 'none',
              }}
              onTransitionEnd={handleTransitionEnd}
              >
                <canvas ref={canvasFrontRef} style={{ display: 'block', maxWidth: '100%' }} />

                {/* Spine shadow on front page while flipping */}
                {isFlipActive && absAngle < 90 && (
                  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: spineShadow }} />
                )}
              </div>

              {/* Cover image overlay (shown while PDF loads, fades out on ready) */}
              {coverUrl && (
                <div style={{
                  position: 'absolute', inset: 0, zIndex: 20,
                  transition: pdfPageReady ? 'opacity 0.65s ease' : 'none',
                  opacity: pdfPageReady ? 0 : 1,
                  pointerEvents: pdfPageReady ? 'none' : 'auto',
                }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={coverUrl} alt="Portada" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  {!pdfPageReady && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 28, background: 'linear-gradient(to top, rgba(0,0,0,0.50) 0%, transparent 55%)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {[0, 140, 280].map(d => (
                          <div key={d} className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: `${d}ms`, opacity: 0.85 }} />
                        ))}
                      </div>
                      {loadSlow && (
                        <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 10, maxWidth: 220, textAlign: 'center', lineHeight: 1.6 }}>
                          Edición en alta resolución.<br />Un momento por favor…
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Fallback loading (no coverUrl) */}
              {isLoading && !coverUrl && (
                <div style={{ width: estW, height: estH, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, background: '#FEFDFB' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {[0, 150, 300].map(d => (
                      <div key={d} className="w-2 h-2 rounded-full animate-bounce" style={{ animationDelay: `${d}ms`, background: GOLD }} />
                    ))}
                  </div>
                  <p style={{ color: '#A89880', fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase' }}>Cargando…</p>
                  {loadSlow && (
                    <p style={{ color: '#B8A090', fontSize: 12, maxWidth: 240, lineHeight: 1.7, textAlign: 'center', marginTop: 4 }}>
                      Las ediciones son de alta resolución.<br />Puede tardar unos momentos.
                    </p>
                  )}
                </div>
              )}

              {/* Hover hint arrows (subtle, fade in/out) */}
              {!isLoading && !isFlipActive && (
                <>
                  {currentPage > 1 && (
                    <div className="group-hint-left" style={{ position: 'absolute', left: 0, top: 0, width: '20%', height: '100%', zIndex: 15, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: 10 }}>
                      <div style={{ opacity: 0.18, color: '#555', fontSize: 28, lineHeight: 1 }}>‹</div>
                    </div>
                  )}
                  {currentPage < numPages && (
                    <div style={{ position: 'absolute', right: 0, top: 0, width: '20%', height: '100%', zIndex: 15, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 10 }}>
                      <div style={{ opacity: 0.18, color: '#555', fontSize: 28, lineHeight: 1 }}>›</div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

      </div>{/* end main viewport */}

      {/* ── Bottom strip: progress + page counter ── */}
      <div style={{ flexShrink: 0, zIndex: 5 }}>
        <div style={{ height: 3, background: 'rgba(0,0,0,0.10)' }}>
          <div style={{ height: '100%', background: `linear-gradient(90deg, ${GOLD}, #E8C050)`, width: `${progress}%`, transition: 'width 0.55s ease' }} />
        </div>
        <div style={{ height: 33, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(237,234,227,0.96)', borderTop: '1px solid rgba(0,0,0,0.07)' }}>
          {!isLoading && (
            <span style={{ fontSize: 11, color: '#9A9080', letterSpacing: '0.28em', textTransform: 'uppercase' }}>
              {currentPage}&thinsp;/&thinsp;{numPages}
            </span>
          )}
        </div>
      </div>

    </div>
  )
}

export default PDFReader
