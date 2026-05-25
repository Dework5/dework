'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import * as pdfjsLib from 'pdfjs-dist'

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
}

const GOLD = '#C8961E'

const WOOD_BG: React.CSSProperties = {
  backgroundColor: '#d8d4cc',
  backgroundImage: `
    repeating-linear-gradient(180deg,
      transparent 0px, transparent 43px,
      rgba(0,0,0,0.10) 43px, rgba(0,0,0,0.10) 44px,
      rgba(255,255,255,0.22) 44px, rgba(255,255,255,0.22) 45px,
      transparent 45px
    ),
    repeating-linear-gradient(88deg,
      transparent 0px, rgba(255,255,255,0.04) 10px,
      transparent 20px, rgba(0,0,0,0.025) 30px
    )
  `,
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
  backUrl, downloadUrl,
}: PDFReaderProps) {

  const [pdf,         setPdf]         = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [numPages,    setNumPages]    = useState(totalPages || 0)
  const [currentPage, setCurrentPage] = useState(1)
  const [scale,       setScale]       = useState(1)
  const [isLoading,   setIsLoading]   = useState(true)  // PDF not yet parsed
  const [error,       setError]       = useState<string | null>(null)
  const [loadSlow,    setLoadSlow]    = useState(false)
  const [pdfReady,    setPdfReady]    = useState(false)  // first page rendered

  // Per-page rendered data URLs
  const [pageUrls, setPageUrls] = useState<Record<number, string>>({})

  // UI overlays
  const [audioOn,      setAudioOn]      = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [ctrlVisible,  setCtrlVisible]  = useState(true)

  const scaleRef      = useRef(1)
  const pageDims      = useRef({ w: 595, h: 842 })
  const renderingSet  = useRef(new Set<number>())     // pages currently being rendered
  const pageFlipRef   = useRef<any>(null)              // PageFlip instance
  const containerRef  = useRef<HTMLDivElement>(null)   // PageFlip DOM target
  const idleTimer     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartX   = useRef(0)
  const flipReady     = useRef(false)                  // PageFlip initialised

  // ── Scale ──────────────────────────────────────────────────────────────
  const calcScale = useCallback(() => {
    if (typeof window === 'undefined') return
    const BOTTOM = 36, PAD_V = 30, PAD_H = 80
    const { w, h } = pageDims.current
    const s = Math.max(0.25, Math.min(
      (window.innerHeight - BOTTOM - PAD_V * 2) / h,
      (window.innerWidth  - PAD_H * 2)          / w,
      3
    ))
    setScale(s); scaleRef.current = s
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
    setIsLoading(true); setError(null); setLoadSlow(false); setPdfReady(false)
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
      const p1 = await doc.getPage(1)
      const vp = p1.getViewport({ scale: 1 })
      pageDims.current = { w: vp.width, h: vp.height }
      calcScale()
      setIsLoading(false)
      setLoadSlow(false)
    }).catch(() => {
      clearTimeout(slow); setError('No se pudo cargar el PDF.'); setIsLoading(false)
    })
    return () => { clearTimeout(slow); task.destroy().catch(() => {}) }
  }, [pdfUrl, calcScale])

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
      await page.render({ canvasContext: ctx, viewport }).promise
      const url = canvas.toDataURL('image/jpeg', 0.88)
      setPageUrls(prev => ({ ...prev, [pageNum]: url }))
      if (pageNum === 1) setPdfReady(true)
    } catch { /* cancelled */ }
    renderingSet.current.delete(pageNum)
  }, [pdf])

  // ── Render first pages when PDF loads, continue in background ─────────
  useEffect(() => {
    if (!pdf || numPages === 0) return
    // Render first 8 pages immediately (≈ covers what user sees first)
    const first = Math.min(8, numPages)
    for (let i = 1; i <= first; i++) renderPage(i)
    // Rest in background after short delay so first pages get priority
    setTimeout(() => {
      for (let i = first + 1; i <= numPages; i++) renderPage(i)
    }, 1200)
  }, [pdf, numPages, renderPage])

  // ── Initialise PageFlip once container + first page are ready ─────────
  useEffect(() => {
    if (!containerRef.current || !pdfReady || flipReady.current) return
    if (numPages === 0 || !pageUrls[1]) return

    const estW = Math.round(pageDims.current.w * scaleRef.current)
    const estH = Math.round(pageDims.current.h * scaleRef.current)

    // Dynamically import page-flip (browser only)
    import('page-flip').then(mod => {
      const PageFlip = mod.PageFlip || mod.default?.PageFlip || mod.default
      if (!PageFlip || !containerRef.current) return

      const pf = new PageFlip(containerRef.current, {
        width:              estW,
        height:             estH,
        size:               'fixed',
        drawShadow:         true,
        flippingTime:       700,
        usePortrait:        true,    // single-page view (like aflip.in)
        showCover:          true,
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
          if (!pageUrls[i]) renderPage(i)
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
  }, [pdfReady, numPages, pageUrls[1]])   // init once when first page URL lands

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
    if (Math.abs(dx) < 45 || !pageFlipRef.current) return
    if (dx > 0) pageFlipRef.current.flipNext()
    else        pageFlipRef.current.flipPrev()
  }

  // ── Derived ────────────────────────────────────────────────────────────
  const estW     = Math.round(pageDims.current.w * scale) || 300
  const estH     = Math.round(pageDims.current.h * scale) || 424
  const progress = numPages > 1 ? ((currentPage - 1) / (numPages - 1)) * 100 : 0

  const iconBtn: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer', padding: 6,
    color: 'rgba(0,0,0,0.40)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  }

  if (error) {
    return (
      <div className="flex items-center justify-center" style={{ height: '100vh', ...WOOD_BG }}>
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
      style={{ height: '100vh', overflow: 'hidden', ...WOOD_BG, display: 'flex', flexDirection: 'column', userSelect: 'none' }}
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

        {/* Top-right: audio + fullscreen */}
        <div style={{ position: 'absolute', top: 10, right: 14, zIndex: 30, display: 'flex', gap: 2, opacity: ctrlVisible ? 1 : 0, transition: 'opacity 0.5s', pointerEvents: ctrlVisible ? 'auto' : 'none' }}>
          <button onClick={() => setAudioOn(a => !a)} style={{ ...iconBtn, color: audioOn ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.18)' }}>
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

        {/* ── Cover overlay: shown while PDF renders, fades out ── */}
        {coverUrl && !pdfReady && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ padding: 3, background: `linear-gradient(145deg, #E8C040, #C8921A, #A87010, #D4A830)`, boxShadow: '0 6px 36px rgba(0,0,0,0.22)' }}>
              <div style={{ position: 'relative', width: estW, height: estH, overflow: 'hidden' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={coverUrl} alt="Portada" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 28 }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[0, 140, 280].map(d => (
                      <div key={d} className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: `${d}ms`, opacity: 0.85 }} />
                    ))}
                  </div>
                  {loadSlow && <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 10, textAlign: 'center', lineHeight: 1.6 }}>Edición en alta resolución.<br />Un momento…</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* No-cover loading fallback */}
        {isLoading && !coverUrl && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {[0, 150, 300].map(d => (
                <div key={d} className="w-2 h-2 rounded-full animate-bounce" style={{ animationDelay: `${d}ms`, background: GOLD }} />
              ))}
            </div>
            <p style={{ color: 'rgba(0,0,0,0.35)', fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase' }}>Cargando…</p>
            {loadSlow && <p style={{ color: 'rgba(0,0,0,0.3)', fontSize: 12, maxWidth: 240, textAlign: 'center', lineHeight: 1.7 }}>Las ediciones son de alta resolución.<br />Puede tardar unos momentos.</p>}
          </div>
        )}

        {/* ── Gold border + PageFlip container ── */}
        <div style={{
          padding: 3,
          background: 'linear-gradient(145deg, #E8C040 0%, #C8921A 35%, #A87010 60%, #D4A830 100%)',
          boxShadow: '0 6px 36px rgba(0,0,0,0.22), 0 2px 10px rgba(0,0,0,0.14)',
          // Hide until first page is rendered to avoid flash
          visibility: pdfReady ? 'visible' : 'hidden',
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
              width:    estW,
              height:   estH,
              overflow: 'hidden',
            }}
          >
            {Array.from({ length: numPages }, (_, i) => {
              const n   = i + 1
              const url = pageUrls[n]
              return (
                <div
                  key={n}
                  className="pf-slot"
                  style={{ background: '#FEFDFB', width: '100%', height: '100%' }}
                >
                  {url
                    ? /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={url} alt={`Página ${n}`} style={{ width: '100%', height: '100%', display: 'block', objectFit: 'fill' }} />
                    : <div style={{ width: '100%', height: '100%', background: '#FAFAF8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: '#ddd', fontSize: Math.round(estH * 0.12), fontStyle: 'italic' }}>{n}</span>
                      </div>
                  }
                </div>
              )
            })}
          </div>
        </div>

      </div>{/* end main viewport */}

      {/* ── Bottom: progress bar + page counter ── */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ height: 3, background: 'rgba(0,0,0,0.12)' }}>
          <div style={{ height: '100%', background: `linear-gradient(90deg, ${GOLD}, #E8C050)`, width: `${progress}%`, transition: 'width 0.55s ease' }} />
        </div>
        <div style={{ height: 33, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(216,212,204,0.97)', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          {!isLoading && numPages > 0 && (
            <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.38)', letterSpacing: '0.28em', textTransform: 'uppercase' }}>
              {currentPage}&thinsp;/&thinsp;{numPages}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
