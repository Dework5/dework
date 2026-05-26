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
  const [coverClosed,  setCoverClosed]  = useState(false)  // user hasn't opened the book yet

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

  // ── Scale ──────────────────────────────────────────────────────────────
  const calcScale = useCallback(() => {
    if (typeof window === 'undefined') return
    const BOTTOM = 36, PAD_V = 20, PAD_H = 24
    const { w, h } = pageDims.current
    // w = one magazine page width (portrait). Fit two side by side.
    const s = Math.max(0.25, Math.min(
      (window.innerHeight - BOTTOM - PAD_V * 2) / h,
      (window.innerWidth  - PAD_H * 2)          / (w * 2),
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
      await page.render({ canvasContext: ctx, viewport, canvas }).promise
      const url = canvas.toDataURL('image/jpeg', 0.80)  // 0.80 = faster encode, still good quality
      setPageUrls(prev => ({ ...prev, [pageNum]: url }))
      if (pageNum === 1) setPdfReady(true)
    } catch { /* cancelled */ }
    renderingSet.current.delete(pageNum)
  }, [pdf])

  // ── Render pages: priority order (cover → first 2 spreads → rest) ──────
  useEffect(() => {
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
  }, [pdf, numPages, renderPage])

  // ── Initialise PageFlip once container + first page are ready ─────────
  useEffect(() => {
    if (!containerRef.current || !pdfReady || flipReady.current) return
    if (numPages === 0 || !pageUrls[1]) return

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

        {/* ── Gold border + PageFlip container ── */}
        <div style={{
          padding: 3,
          background: 'linear-gradient(145deg, #E8C040 0%, #C8921A 35%, #A87010 60%, #D4A830 100%)',
          boxShadow: '0 6px 36px rgba(0,0,0,0.22), 0 2px 10px rgba(0,0,0,0.14)',
          // Hidden behind the cover overlay until the book opens
          visibility: (pdfReady && coverClosed) ? 'visible' : 'hidden',
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
                Slot layout — three cases:

                (C) All-portrait (isSpreadPDF=false):
                  slot i → PDF page i+1

                (A) Mixed — portrait cover + landscape spreads (isSpreadPDF, !isAllSpread):
                  slot 0         → PDF page 1 (portrait cover), full width estW
                  slot 1         → LEFT  half of PDF page 2 (landscape, canvas = 2×estW)
                  slot 2         → RIGHT half of PDF page 2
                  slot 3         → LEFT  half of PDF page 3  …

                (B) All-landscape (isAllSpread):
                  slot 0         → LEFT  half of PDF page 1
                  slot 1         → RIGHT half of PDF page 1
                  slot 2         → LEFT  half of PDF page 2  …

                Each slot is estW × estH with overflow:hidden.
                Landscape halves use position:absolute + left offset to clip the right half.
              */
              let pdfPage: number
              let isRightHalf = false
              let imgW = estW  // default: portrait page, natural width

              if (isAllSpread.current) {
                // (B) All-landscape
                const k = Math.floor(i / 2)
                pdfPage     = k + 1
                isRightHalf = i % 2 === 1
                imgW        = estW * 2
              } else if (i === 0) {
                // (A/C) Cover is always PDF page 1 (portrait)
                pdfPage = 1
              } else if (isSpreadPDF.current) {
                // (A) Mixed — pages 2+ are landscape spreads
                const k = Math.floor((i - 1) / 2)
                pdfPage     = k + 2
                isRightHalf = (i - 1) % 2 === 1
                imgW        = estW * 2
              } else {
                // (C) All-portrait
                pdfPage = i + 1
              }

              const url = pageUrls[pdfPage]

              return (
                <div
                  key={i}
                  className="pf-slot"
                  style={{ background: '#FEFDFB', width: estW, height: estH, overflow: 'hidden', position: 'relative', flexShrink: 0 }}
                >
                  {url
                    ? /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={url}
                        alt={`Página ${pdfPage}`}
                        style={{
                          position: 'absolute',
                          width: imgW,
                          height: estH,
                          left: isRightHalf ? -estW : 0,
                          top: 0,
                          display: 'block',
                        }}
                      />
                    : <div style={{ width: '100%', height: '100%', background: '#FAFAF8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: '#ddd', fontSize: Math.round(estH * 0.12), fontStyle: 'italic' }}>{pdfPage}</span>
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
