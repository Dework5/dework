'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'

// Use local worker served from /public to avoid CDN round-trip
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

interface PDFReaderProps {
  pdfUrl:      string
  issueId:     string
  totalPages?: number
  coverUrl?:   string
}

// ── Sound ──────────────────────────────────────────────────────────────────
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

// ── Keyframes injected once ────────────────────────────────────────────────
const SLIDE_CSS = `
  @keyframes dw-out-left  { from{transform:translateX(0)}    to{transform:translateX(-100%)} }
  @keyframes dw-in-right  { from{transform:translateX(100%)}  to{transform:translateX(0)} }
  @keyframes dw-out-right { from{transform:translateX(0)}    to{transform:translateX(100%)} }
  @keyframes dw-in-left   { from{transform:translateX(-100%)} to{transform:translateX(0)} }
`

const ANIM_MS = 260
const GOLD    = '#C8961E'

// ── SVG icons ─────────────────────────────────────────────────────────────
function IconSoundOn()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg> }
function IconSoundOff() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg> }
function IconExpand()   { return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg> }
function IconCompress() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg> }
function IconChevLeft() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"/></svg> }
function IconChevRight(){ return <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg> }

export function PDFReader({ pdfUrl, issueId, totalPages, coverUrl }: PDFReaderProps) {
  const canvasFrontRef  = useRef<HTMLCanvasElement>(null)
  const canvasBackRef   = useRef<HTMLCanvasElement>(null)
  const containerRef    = useRef<HTMLDivElement>(null)

  const [pdf,          setPdf]          = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [currentPage,  setCurrentPage]  = useState(1)
  const [numPages,     setNumPages]     = useState(totalPages || 0)
  const [scale,        setScale]        = useState(1)
  const [isLoading,    setIsLoading]    = useState(true)
  const [pdfPageReady, setPdfPageReady] = useState(false)
  const [isAnimating,  setIsAnimating]  = useState(false)
  const [flipDir,      setFlipDir]      = useState<'forward' | 'backward'>('forward')
  const [error,        setError]        = useState<string | null>(null)
  const [loadSlow,     setLoadSlow]     = useState(false)
  const [audioOn,      setAudioOn]      = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [ctrlVisible,  setCtrlVisible]  = useState(true)

  const isFlipping      = useRef(false)
  const skipRerender    = useRef(false)
  const scaleRef        = useRef(1)
  const renderTaskFront = useRef<pdfjsLib.RenderTask | null>(null)
  const renderTaskBack  = useRef<pdfjsLib.RenderTask | null>(null)
  const pageDims        = useRef({ w: 595, h: 842 })
  const touchX          = useRef(0)
  const idleTimer       = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Scale ──────────────────────────────────────────────────────────────
  const calcScale = useCallback(() => {
    if (typeof window === 'undefined') return
    const BOTTOM = 36   // thin bottom strip
    const PAD_V  = 16   // vertical breathing room
    const PAD_H  = 20   // horizontal (arrows overlay, so minimal)
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

  // ── Fullscreen ────────────────────────────────────────────────────────
  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', h)
    return () => document.removeEventListener('fullscreenchange', h)
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }, [])

  // ── Controls auto-hide (3.5 s idle) ──────────────────────────────────
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

  // ── Track view ────────────────────────────────────────────────────────
  useEffect(() => {
    let sid = sessionStorage.getItem('dework_session')
    if (!sid) { sid = crypto.randomUUID(); sessionStorage.setItem('dework_session', sid) }
    fetch('/api/track-view', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issueId, sessionId: sid }),
    }).catch(() => {})
  }, [issueId])

  // ── Load PDF ──────────────────────────────────────────────────────────
  useEffect(() => {
    setIsLoading(true)
    setError(null)
    setLoadSlow(false)
    setPdfPageReady(false)

    const slowTimer = setTimeout(() => setLoadSlow(true), 12000)

    const task = pdfjsLib.getDocument({
      url: pdfUrl,
      cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
      cMapPacked: true,
      rangeChunkSize: 65536,
      disableRange: false,
      disableStream: false,
    })

    task.promise
      .then(async doc => {
        clearTimeout(slowTimer)
        setPdf(doc)
        setNumPages(doc.numPages)
        const p1 = await doc.getPage(1)
        const vp = p1.getViewport({ scale: 1 })
        pageDims.current = { w: vp.width, h: vp.height }
        calcScale()
        setIsLoading(false)
        setLoadSlow(false)
      })
      .catch(() => {
        clearTimeout(slowTimer)
        setError('No se pudo cargar el PDF.')
        setIsLoading(false)
      })

    return () => { clearTimeout(slowTimer); task.destroy().catch(() => {}) }
  }, [pdfUrl, calcScale])

  // ── Render page to canvas ─────────────────────────────────────────────
  const renderToCanvas = useCallback(async (
    pageNum: number,
    s: number,
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
      canvas.height  = viewport.height
      canvas.width   = viewport.width
      const t = page.render({ canvasContext: ctx, viewport, canvas })
      taskRef.current = t
      await t.promise
    } catch (e: unknown) {
      if ((e as { name?: string })?.name !== 'RenderingCancelledException') console.error(e)
    }
  }, [pdf])

  // ── Initial render ────────────────────────────────────────────────────
  useEffect(() => {
    if (!pdf || isAnimating) return
    if (skipRerender.current) { skipRerender.current = false; return }
    renderToCanvas(currentPage, scale, canvasFrontRef.current, renderTaskFront)
      .then(() => setPdfPageReady(true))
  }, [pdf, currentPage, scale, isAnimating, renderToCanvas])

  // ── Animation end: copy back→front, reset ────────────────────────────
  const handleAnimationEnd = useCallback((e: React.AnimationEvent) => {
    const expected = flipDir === 'forward' ? 'dw-out-left' : 'dw-out-right'
    if (e.animationName !== expected) return

    const front = canvasFrontRef.current
    const back  = canvasBackRef.current
    if (front && back) {
      front.width  = back.width
      front.height = back.height
      front.getContext('2d')?.drawImage(back, 0, 0)
    }

    skipRerender.current = true
    isFlipping.current = false
    setIsAnimating(false)

    const sid = sessionStorage.getItem('dework_session') || ''
    fetch('/api/track-page', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issueId, sessionId: sid, pageNumber: currentPage }),
    }).catch(() => {})
  }, [flipDir, currentPage, issueId])

  // ── Navigate ──────────────────────────────────────────────────────────
  const goTo = useCallback(async (p: number) => {
    if (!pdf || p < 1 || p > numPages || isLoading || isFlipping.current) return
    const dir: 'forward' | 'backward' = p > currentPage ? 'forward' : 'backward'
    isFlipping.current = true
    setFlipDir(dir)

    const destPage = await pdf.getPage(p)
    const destVp   = destPage.getViewport({ scale: 1 })
    pageDims.current = { w: destVp.width, h: destVp.height }
    calcScale()

    await renderToCanvas(p, scaleRef.current, canvasBackRef.current, renderTaskBack)
    setCurrentPage(p)
    if (audioOn) playPageSound()
    setIsAnimating(true)
  }, [pdf, numPages, isLoading, currentPage, renderToCanvas, calcScale, audioOn])

  const prevPage = useCallback(() => goTo(currentPage - 1), [goTo, currentPage])
  const nextPage = useCallback(() => goTo(currentPage + 1), [goTo, currentPage])

  // ── Keyboard ──────────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); nextPage() }
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   { e.preventDefault(); prevPage() }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [nextPage, prevPage])

  // ── Touch ─────────────────────────────────────────────────────────────
  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX }
  const onTouchEnd   = (e: React.TouchEvent) => {
    const dx = touchX.current - e.changedTouches[0].clientX
    if (Math.abs(dx) > 45) { dx > 0 ? nextPage() : prevPage() }
  }

  // ── Derived ───────────────────────────────────────────────────────────
  const estW     = Math.round(pageDims.current.w * scale) || 300
  const estH     = Math.round(pageDims.current.h * scale) || 424
  const progress = numPages > 1 ? ((currentPage - 1) / (numPages - 1)) * 100 : 0

  const frontAnim = isAnimating
    ? `${flipDir === 'forward' ? 'dw-out-left' : 'dw-out-right'} ${ANIM_MS}ms cubic-bezier(.4,0,.2,1) forwards`
    : 'none'
  const backAnim  = isAnimating
    ? `${flipDir === 'forward' ? 'dw-in-right' : 'dw-in-left'} ${ANIM_MS}ms cubic-bezier(.4,0,.2,1) forwards`
    : 'none'

  // ── Error screen ──────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex items-center justify-center"
        style={{ height: '100vh', background: '#F0EDE6' }}>
        <div className="text-center space-y-4 px-6">
          <p className="text-gray-500 text-sm">{error}</p>
          <button onClick={() => window.location.reload()}
            className="text-[11px] tracking-widest uppercase border-b border-gray-400 hover:text-gray-900 transition-colors">
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        height: '100vh',
        overflow: 'hidden',
        /* Subtle warm off-white — resembles a linen/paper background */
        background: '#EDEAE3',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <style>{SLIDE_CSS}</style>

      {/* ── Main viewport ── */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>

        {/* ── Top-right floating controls ── */}
        <div style={{
          position: 'absolute', top: 14, right: 16, zIndex: 30,
          display: 'flex', gap: 8,
          opacity: ctrlVisible ? 1 : 0,
          transition: 'opacity 0.5s ease',
          pointerEvents: ctrlVisible ? 'auto' : 'none',
        }}>
          {/* Audio */}
          <button
            onClick={() => setAudioOn(a => !a)}
            title={audioOn ? 'Silenciar' : 'Activar sonido'}
            className="flex items-center justify-center transition-colors"
            style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(30,25,20,0.50)',
              backdropFilter: 'blur(6px)',
              border: 'none', cursor: 'pointer',
              color: audioOn ? '#fff' : 'rgba(255,255,255,0.35)',
            }}
          >
            {audioOn ? <IconSoundOn /> : <IconSoundOff />}
          </button>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            className="flex items-center justify-center"
            style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(30,25,20,0.50)',
              backdropFilter: 'blur(6px)',
              border: 'none', cursor: 'pointer',
              color: '#fff',
            }}
          >
            {isFullscreen ? <IconCompress /> : <IconExpand />}
          </button>
        </div>

        {/* ── Left navigation arrow ── */}
        {!isLoading && currentPage > 1 && (
          <button
            onClick={prevPage}
            aria-label="Anterior"
            className="group absolute left-0 top-0 h-full flex items-center justify-start"
            style={{ width: '13%', background: 'transparent', border: 'none', cursor: 'pointer', paddingLeft: 8, zIndex: 10 }}
          >
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center rounded-full"
              style={{ width: 40, height: 40, background: 'rgba(30,25,20,0.42)', backdropFilter: 'blur(8px)', color: '#fff' }}>
              <IconChevLeft />
            </div>
          </button>
        )}

        {/* ── Right navigation arrow ── */}
        {!isLoading && currentPage < numPages && (
          <button
            onClick={nextPage}
            aria-label="Siguiente"
            className="group absolute right-0 top-0 h-full flex items-center justify-end"
            style={{ width: '13%', background: 'transparent', border: 'none', cursor: 'pointer', paddingRight: 8, zIndex: 10 }}
          >
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center rounded-full"
              style={{ width: 40, height: 40, background: 'rgba(30,25,20,0.42)', backdropFilter: 'blur(8px)', color: '#fff' }}>
              <IconChevRight />
            </div>
          </button>
        )}

        {/* ── Magazine frame with gold border ── */}
        <div ref={containerRef} style={{ position: 'relative', zIndex: 2 }}>
          {/* Gold gradient border (padding trick) */}
          <div style={{
            padding: 3,
            background: 'linear-gradient(145deg, #E8C040 0%, #C8921A 35%, #A87010 60%, #D4A830 100%)',
            boxShadow: '0 6px 36px rgba(0,0,0,0.20), 0 2px 10px rgba(0,0,0,0.14)',
          }}>
            {/* Inner page surface */}
            <div style={{
              background: '#FEFDFB',
              overflow: 'hidden',
              position: 'relative',
              width: estW,
              minHeight: isLoading ? estH : undefined,
            }}>

              {/* BACK canvas — slides in from side during animation */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                zIndex: 0,
                opacity: isAnimating ? undefined : 0,
                pointerEvents: 'none',
                animation: backAnim,
              }}>
                <canvas ref={canvasBackRef} style={{ display: 'block' }} />
              </div>

              {/* FRONT canvas — slides out during animation */}
              <div style={{
                position: 'relative', zIndex: 1,
                animation: frontAnim,
              }}
              onAnimationEnd={handleAnimationEnd}>
                <canvas ref={canvasFrontRef} style={{ display: 'block', maxWidth: '100%' }} />
              </div>

              {/* Cover image overlay — shown instantly, fades out when PDF renders */}
              {coverUrl && (
                <div style={{
                  position: 'absolute', inset: 0, zIndex: 20,
                  transition: pdfPageReady ? 'opacity 0.65s ease' : 'none',
                  opacity: pdfPageReady ? 0 : 1,
                  pointerEvents: pdfPageReady ? 'none' : 'auto',
                }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={coverUrl}
                    alt="Portada"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                  {!pdfPageReady && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'flex-end',
                      paddingBottom: 28,
                      background: 'linear-gradient(to top, rgba(0,0,0,0.50) 0%, transparent 55%)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {[0, 140, 280].map(d => (
                          <div key={d} className="w-1.5 h-1.5 rounded-full bg-white animate-bounce"
                            style={{ animationDelay: `${d}ms`, opacity: 0.85 }} />
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
                <div style={{
                  width: estW, height: estH,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 18,
                  background: '#FEFDFB',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {[0, 150, 300].map(d => (
                      <div key={d} className="w-2 h-2 rounded-full animate-bounce"
                        style={{ animationDelay: `${d}ms`, background: GOLD }} />
                    ))}
                  </div>
                  <p style={{ color: '#A89880', fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase' }}>
                    Cargando…
                  </p>
                  {loadSlow && (
                    <p style={{ color: '#B8A090', fontSize: 12, maxWidth: 240, lineHeight: 1.7, textAlign: 'center', marginTop: 4 }}>
                      Las ediciones son de alta resolución.<br />Puede tardar unos momentos.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>{/* end main viewport */}

      {/* ── Bottom strip: progress + page counter ── */}
      <div style={{ flexShrink: 0, zIndex: 5 }}>
        {/* Gold progress bar */}
        <div style={{ height: 3, background: 'rgba(0,0,0,0.10)' }}>
          <div style={{
            height: '100%',
            background: `linear-gradient(90deg, ${GOLD}, #E8C050)`,
            width: `${progress}%`,
            transition: 'width 0.55s ease',
          }} />
        </div>
        {/* Page counter */}
        <div style={{
          height: 33, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(237,234,227,0.96)', borderTop: '1px solid rgba(0,0,0,0.07)',
        }}>
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
