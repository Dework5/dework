'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

interface PDFReaderProps {
  pdfUrl:      string
  issueId:     string
  totalPages?: number
}

type FlipPhase = 'idle' | 'exit' | 'enter-start' | 'enter'

const HALF = 170 // ms per half-flip

// Synthetic paper-rustle via Web Audio API
function playPageSound() {
  try {
    const ctx  = new AudioContext()
    const sr   = ctx.sampleRate
    const dur  = 0.11
    const len  = Math.floor(sr * dur)
    const buf  = ctx.createBuffer(1, len, sr)
    const data = buf.getChannelData(0)

    for (let i = 0; i < len; i++) {
      const t   = i / len
      const env = Math.pow(1 - t, 2.2) * (1 + Math.sin(t * Math.PI * 2) * 0.15)
      data[i]   = (Math.random() * 2 - 1) * env * 0.38
    }

    const src = ctx.createBufferSource()
    src.buffer = buf

    const bpf = ctx.createBiquadFilter()
    bpf.type            = 'bandpass'
    bpf.frequency.value = 3000
    bpf.Q.value         = 0.7

    const gain      = ctx.createGain()
    gain.gain.value = 0.65

    src.connect(bpf)
    bpf.connect(gain)
    gain.connect(ctx.destination)
    src.start()
    src.onended = () => ctx.close().catch(() => {})
  } catch {
    // AudioContext blocked or unavailable - silent fallback
  }
}

export function PDFReader({ pdfUrl, issueId, totalPages }: PDFReaderProps) {
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const [pdf,          setPdf]          = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [currentPage,  setCurrentPage]  = useState(1)
  const [numPages,     setNumPages]     = useState(totalPages || 0)
  const [scale,        setScale]        = useState(1)
  const [isLoading,    setIsLoading]    = useState(true)
  const [flipPhase,    setFlipPhase]    = useState<FlipPhase>('idle')
  const [flipDir,      setFlipDir]      = useState<'forward' | 'backward'>('forward')
  const [error,        setError]        = useState<string | null>(null)
  const renderTaskRef  = useRef<pdfjsLib.RenderTask | null>(null)
  const pageDims       = useRef({ w: 595, h: 842 })

  const calcScale = useCallback(() => {
    if (typeof window === 'undefined') return
    const TOP = 56, BOTTOM = 56, PAD_V = 24, PAD_H = 48
    const availH = window.innerHeight - TOP - BOTTOM - PAD_V * 2
    const availW = window.innerWidth  - PAD_H * 2
    const { w, h } = pageDims.current
    setScale(Math.max(0.3, Math.min(availH / h, availW / w, 3)))
  }, [])

  useEffect(() => {
    calcScale()
    window.addEventListener('resize', calcScale)
    return () => window.removeEventListener('resize', calcScale)
  }, [calcScale])

  useEffect(() => {
    let sid = sessionStorage.getItem('dework_session')
    if (!sid) { sid = crypto.randomUUID(); sessionStorage.setItem('dework_session', sid) }
    fetch('/api/track-view', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issueId, sessionId: sid }),
    }).catch(() => {})
  }, [issueId])

  useEffect(() => {
    setIsLoading(true)
    setError(null)
    const task = pdfjsLib.getDocument({
      url: pdfUrl,
      cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
      cMapPacked: true,
    })
    task.promise
      .then(async doc => {
        setPdf(doc)
        setNumPages(doc.numPages)
        const p1 = await doc.getPage(1)
        const vp = p1.getViewport({ scale: 1 })
        pageDims.current = { w: vp.width, h: vp.height }
        calcScale()
        setIsLoading(false)
      })
      .catch(() => { setError('No se pudo cargar el PDF.'); setIsLoading(false) })
    return () => { task.destroy().catch(() => {}) }
  }, [pdfUrl, calcScale])

  const renderPage = useCallback(async (pageNum: number, s: number) => {
    if (!pdf || !canvasRef.current) return
    if (renderTaskRef.current) { renderTaskRef.current.cancel() }
    try {
      const page     = await pdf.getPage(pageNum)
      const viewport = page.getViewport({ scale: s })
      const canvas   = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      canvas.height = viewport.height
      canvas.width  = viewport.width
      const t = page.render({ canvasContext: ctx, viewport, canvas })
      renderTaskRef.current = t
      await t.promise
      const sid = sessionStorage.getItem('dework_session') || ''
      fetch('/api/track-page', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId, sessionId: sid, pageNumber: pageNum }),
      }).catch(() => {})
    } catch (e: unknown) {
      if ((e as { name?: string })?.name !== 'RenderingCancelledException') console.error(e)
    }
  }, [pdf, issueId])

  useEffect(() => {
    if (pdf) renderPage(currentPage, scale)
  }, [pdf, currentPage, scale, renderPage])

  const goTo = useCallback((p: number) => {
    if (p < 1 || p > numPages || isLoading || flipPhase !== 'idle') return
    const dir: 'forward' | 'backward' = p > currentPage ? 'forward' : 'backward'
    playPageSound()
    setFlipDir(dir)
    setFlipPhase('exit')
    setTimeout(() => {
      setCurrentPage(p)
      setFlipPhase('enter-start')
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setFlipPhase('enter')
          setTimeout(() => setFlipPhase('idle'), HALF)
        })
      })
    }, HALF)
  }, [numPages, isLoading, currentPage, flipPhase])

  const prevPage = useCallback(() => goTo(currentPage - 1), [goTo, currentPage])
  const nextPage = useCallback(() => goTo(currentPage + 1), [goTo, currentPage])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); nextPage() }
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   { e.preventDefault(); prevPage() }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [nextPage, prevPage])

  const touchX = useRef(0)
  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX }
  const onTouchEnd   = (e: React.TouchEvent) => {
    const dx = touchX.current - e.changedTouches[0].clientX
    if (Math.abs(dx) > 45) { dx > 0 ? nextPage() : prevPage() }
  }

  const canvasWrapStyle = (): React.CSSProperties => {
    const P = 'perspective(1400px)'
    switch (flipPhase) {
      case 'exit':
        return { transition: `transform ${HALF}ms cubic-bezier(.55,.0,1,.45)`,
                 transform:  `${P} rotateY(${flipDir === 'forward' ? -90 : 90}deg)` }
      case 'enter-start':
        return { transition: 'none',
                 transform:  `${P} rotateY(${flipDir === 'forward' ? 90 : -90}deg)` }
      case 'enter':
        return { transition: `transform ${HALF}ms cubic-bezier(.0,.55,.45,1)`,
                 transform:  `${P} rotateY(0deg)` }
      default:
        return { transition: 'none', transform: `${P} rotateY(0deg)` }
    }
  }

  const progress = numPages > 1 ? ((currentPage - 1) / (numPages - 1)) * 100 : 0
  const estW = Math.round(pageDims.current.w * scale) || 300
  const estH = Math.round(pageDims.current.h * scale) || 424

  if (error) {
    return (
      <div className="flex items-center justify-center"
        style={{ height: 'calc(100vh - 56px)', background: '#D6CCBE' }}>
        <div className="text-center space-y-4 px-6">
          <p className="text-gray-500">{error}</p>
          <button onClick={() => window.location.reload()}
            className="text-sm tracking-widest uppercase border-b border-gray-400 hover:text-gray-900 transition-colors">
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        height: 'calc(100vh - 56px)', overflow: 'hidden',
        background: 'radial-gradient(ellipse at 50% 40%, #CEC2B0 0%, #B8A898 100%)',
        display: 'flex', flexDirection: 'column', userSelect: 'none',
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
        {!isLoading && currentPage > 1 && (
          <button onClick={prevPage} aria-label="Anterior"
            style={{ position: 'absolute', left: 0, top: 0, width: '22%', height: '100%', zIndex: 10, background: 'transparent', border: 'none', cursor: 'w-resize', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: 14 }}
            className="group">
            <div className="w-10 h-10 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-90 transition-all duration-200"
              style={{ background: 'rgba(255,255,255,0.65)', backdropFilter: 'blur(8px)', boxShadow: '0 2px 12px rgba(0,0,0,0.18)' }}>
              <span style={{ fontSize: 22, color: '#555', lineHeight: 1 }}>&#8249;</span>
            </div>
          </button>
        )}
        {!isLoading && currentPage < numPages && (
          <button onClick={nextPage} aria-label="Siguiente"
            style={{ position: 'absolute', right: 0, top: 0, width: '22%', height: '100%', zIndex: 10, background: 'transparent', border: 'none', cursor: 'e-resize', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 14 }}
            className="group">
            <div className="w-10 h-10 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-90 transition-all duration-200"
              style={{ background: 'rgba(255,255,255,0.65)', backdropFilter: 'blur(8px)', boxShadow: '0 2px 12px rgba(0,0,0,0.18)' }}>
              <span style={{ fontSize: 22, color: '#555', lineHeight: 1 }}>&#8250;</span>
            </div>
          </button>
        )}
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, zIndex: 2 }}>
            <div className="animate-pulse" style={{
              width: estW, height: estH,
              background: 'linear-gradient(160deg,#F2EDE6 25%,#F8F5F1 50%,#F2EDE6 75%)',
              borderRadius: 2,
              border: '1px solid rgba(180,155,120,0.3)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.10), 0 8px 20px rgba(0,0,0,0.14), 0 30px 60px rgba(0,0,0,0.20), inset 0 0 0 1px rgba(255,255,255,0.85)',
            }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {[0, 150, 300].map(d => (
                <div key={d} className="w-2 h-2 rounded-full bg-[#C5A56B] animate-bounce"
                  style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
            <p style={{ color: '#A89880', fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase' }}>Cargando revista...</p>
          </div>
        ) : (
          <div style={{ position: 'relative', zIndex: 2, ...canvasWrapStyle() }}>
            <div style={{
              borderRadius: 2,
              borderLeft: '3px solid rgba(100,80,55,0.18)',
              borderRight: '1px solid rgba(180,160,130,0.25)',
              borderTop: '1px solid rgba(180,160,130,0.20)',
              borderBottom: '1px solid rgba(120,100,70,0.25)',
              background: '#FEFDFB',
              boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 4px 10px rgba(0,0,0,0.10), 0 12px 30px rgba(0,0,0,0.16), 0 35px 70px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.95), inset -3px 0 8px rgba(0,0,0,0.04)',
              overflow: 'hidden',
            }}>
              <canvas ref={canvasRef} style={{ display: 'block', maxWidth: '100%' }} />
            </div>
            <div style={{
              position: 'absolute', bottom: 0, left: '50%',
              transform: 'translate(-50%, 100%)',
              background: 'rgba(255,255,255,0.72)',
              backdropFilter: 'blur(4px)',
              border: '1px solid rgba(0,0,0,0.08)',
              padding: '1px 10px 2px',
              borderRadius: '0 0 4px 4px',
              fontSize: 9, letterSpacing: '0.22em',
              color: '#888', textTransform: 'uppercase',
              boxShadow: '0 2px 6px rgba(0,0,0,0.10)',
            }}>
              {currentPage}
            </div>
          </div>
        )}
      </div>
      <div style={{ flexShrink: 0, position: 'relative', zIndex: 5 }}>
        <div style={{ height: 2, background: 'rgba(0,0,0,0.12)' }}>
          <div style={{ height: '100%', background: 'linear-gradient(90deg,#B8882A,#E0B860)', width: `${progress}%`, transition: 'width 0.55s ease' }} />
        </div>
        <div style={{ height: 54, background: '#fff', borderTop: '1px solid rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', boxShadow: '0 -4px 20px rgba(0,0,0,0.06)' }}>
          <button onClick={prevPage} disabled={currentPage <= 1 || isLoading}
            className="flex items-center gap-2 transition-colors"
            style={{ color: currentPage <= 1 ? '#ccc' : '#555', minWidth: 90, cursor: currentPage <= 1 ? 'default' : 'pointer' }}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>&#8249;</span>
            <span className="text-[11px] tracking-[0.15em] uppercase hidden sm:block">Anterior</span>
          </button>
          {isLoading ? (
            <span style={{ color: '#ccc', fontSize: 14 }}>...</span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1, gap: 3 }}>
              <span style={{ fontSize: 15, color: '#111', fontWeight: 300, letterSpacing: '0.03em' }}>
                {currentPage}
                <span style={{ color: '#ddd', margin: '0 5px' }}>/</span>
                <span style={{ color: '#aaa', fontSize: 13 }}>{numPages}</span>
              </span>
              <span style={{ fontSize: 9, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#bbb' }}>pagina</span>
            </div>
          )}
          <button onClick={nextPage} disabled={!numPages || currentPage >= numPages || isLoading}
            className="flex items-center gap-2 justify-end transition-colors"
            style={{ color: currentPage >= numPages ? '#ccc' : '#555', minWidth: 90, cursor: currentPage >= numPages ? 'default' : 'pointer' }}>
            <span className="text-[11px] tracking-[0.15em] uppercase hidden sm:block">Siguiente</span>
            <span style={{ fontSize: 20, lineHeight: 1 }}>&#8250;</span>
          </button>
        </div>
      </div>
    </div>
  )
}


export default PDFReader
