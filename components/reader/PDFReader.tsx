'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

interface PDFReaderProps {
  pdfUrl: string
  issueId: string
  totalPages?: number
}

type SlideDir = 'forward' | 'backward' | null

export function PDFReader({ pdfUrl, issueId, totalPages }: PDFReaderProps) {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const [pdf,         setPdf]         = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [numPages,    setNumPages]    = useState(totalPages || 0)
  const [scale,       setScale]       = useState(1)
  const [isLoading,   setIsLoading]   = useState(true)
  const [slideDir,    setSlideDir]    = useState<SlideDir>(null)
  const [error,       setError]       = useState<string | null>(null)
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null)
  const pageDims      = useRef({ w: 595, h: 842 })

  // ── Escala basada en el ALTO disponible (elimina scroll vertical) ──
  const calcScale = useCallback(() => {
    const TOP    = 56
    const BOTTOM = 56
    const PAD_V  = 20
    const PAD_H  = 40
    const availH = window.innerHeight - TOP - BOTTOM - PAD_V * 2
    const availW = window.innerWidth  - PAD_H * 2
    const { w, h } = pageDims.current
    const s = Math.min(availH / h, availW / w, 3)
    setScale(Math.max(0.3, s))
  }, [])

  useEffect(() => {
    calcScale()
    window.addEventListener('resize', calcScale)
    return () => window.removeEventListener('resize', calcScale)
  }, [calcScale])

  // ── Session tracking ──────────────────────────────────────────────
  useEffect(() => {
    let sid = sessionStorage.getItem('dework_session')
    if (!sid) { sid = crypto.randomUUID(); sessionStorage.setItem('dework_session', sid) }
    fetch('/api/track-view', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issueId, sessionId: sid }),
    }).catch(() => {})
  }, [issueId])

  // ── Cargar PDF ────────────────────────────────────────────────────
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

  // ── Renderizar página ─────────────────────────────────────────────
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

  // ── Navegación ────────────────────────────────────────────────────
  const ANIM = 170

  const goTo = useCallback((p: number) => {
    if (p < 1 || p > numPages || isLoading || slideDir !== null) return
    const dir: SlideDir = p > currentPage ? 'forward' : 'backward'
    setSlideDir(dir)
    setTimeout(() => { setCurrentPage(p); setSlideDir(null) }, ANIM)
  }, [numPages, isLoading, currentPage, slideDir])

  const prevPage = useCallback(() => goTo(currentPage - 1), [goTo, currentPage])
  const nextPage = useCallback(() => goTo(currentPage + 1), [goTo, currentPage])

  // ── Teclado ───────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); nextPage() }
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   { e.preventDefault(); prevPage() }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [nextPage, prevPage])

  // ── Swipe ─────────────────────────────────────────────────────────
  const touchX = useRef(0)
  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX }
  const onTouchEnd   = (e: React.TouchEvent) => {
    const dx = touchX.current - e.changedTouches[0].clientX
    if (Math.abs(dx) > 45) { dx > 0 ? nextPage() : prevPage() }
  }

  const progress = numPages > 1 ? ((currentPage - 1) / (numPages - 1)) * 100 : 0

  const slideStyle: React.CSSProperties = {
    transition: `transform ${ANIM}ms cubic-bezier(.4,0,.2,1), opacity ${ANIM}ms ease`,
    transform: slideDir === 'forward'  ? 'translateX(-56px) scale(0.97)'
             : slideDir === 'backward' ? 'translateX(56px)  scale(0.97)'
             : 'translateX(0) scale(1)',
    opacity:   slideDir ? 0 : 1,
    willChange: 'transform, opacity',
  }

  if (error) {
    return (
      <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 56px)', background: '#F0EDE8' }}>
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

  const estW = Math.round(pageDims.current.w * scale) || 300
  const estH = Math.round(pageDims.current.h * scale) || 424

  return (
    <div
      style={{ height: 'calc(100vh - 56px)', overflow: 'hidden', background: '#F0EDE8', display: 'flex', flexDirection: 'column', userSelect: 'none' }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* ── ÁREA DE LECTURA (ocupa todo el espacio disponible) ──── */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>

        {/* Zona click ← */}
        {!isLoading && currentPage > 1 && (
          <button onClick={prevPage} aria-label="Página anterior"
            style={{ position: 'absolute', left: 0, top: 0, width: '22%', height: '100%', zIndex: 10, background: 'transparent', border: 'none', cursor: 'w-resize', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: 12 }}
            className="group"
          >
            <div className="w-9 h-9 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200"
              style={{ background: 'rgba(0,0,0,0.1)', backdropFilter: 'blur(4px)' }}>
              <span style={{ fontSize: 22, color: 'rgba(0,0,0,0.6)', lineHeight: 1 }}>‹</span>
            </div>
          </button>
        )}

        {/* Zona click → */}
        {!isLoading && currentPage < numPages && (
          <button onClick={nextPage} aria-label="Página siguiente"
            style={{ position: 'absolute', right: 0, top: 0, width: '22%', height: '100%', zIndex: 10, background: 'transparent', border: 'none', cursor: 'e-resize', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 12 }}
            className="group"
          >
            <div className="w-9 h-9 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200"
              style={{ background: 'rgba(0,0,0,0.1)', backdropFilter: 'blur(4px)' }}>
              <span style={{ fontSize: 22, color: 'rgba(0,0,0,0.6)', lineHeight: 1 }}>›</span>
            </div>
          </button>
        )}

        {/* Página */}
        {isLoading ? (
          <div className="flex flex-col items-center gap-5">
            <div className="animate-pulse"
              style={{ width: Math.min(estW, window.innerWidth - 80), height: Math.min(estH, window.innerHeight - 140), background: 'linear-gradient(135deg,#E8E4DF 25%,#EBE8E3 50%,#E8E4DF 75%)', boxShadow: '0 4px 32px rgba(0,0,0,0.1)' }} />
            <div className="flex items-center gap-2">
              {[0,150,300].map(d => (
                <div key={d} className="w-2 h-2 rounded-full bg-[#C5A56B] animate-bounce" style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
            <p className="text-gray-400 text-[11px] tracking-[0.3em] uppercase">Cargando revista…</p>
          </div>
        ) : (
          <div style={slideStyle}>
            <canvas ref={canvasRef}
              style={{ display: 'block', maxWidth: '100%', boxShadow: '0 2px 6px rgba(0,0,0,0.06), 0 10px 40px rgba(0,0,0,0.13)' }} />
          </div>
        )}
      </div>

      {/* ── BARRA INFERIOR ──────────────────────────────────────── */}
      <div style={{ flexShrink: 0 }}>
        {/* Progreso */}
        <div style={{ height: 2, background: 'rgba(0,0,0,0.06)' }}>
          <div style={{ height: '100%', background: '#C5A56B', width: `${progress}%`, transition: 'width 0.6s ease' }} />
        </div>
        {/* Nav */}
        <div style={{ height: 54, background: '#fff', borderTop: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', boxShadow: '0 -4px 20px rgba(0,0,0,0.05)' }}>
          <button onClick={prevPage} disabled={currentPage <= 1 || isLoading}
            className="flex items-center gap-2 transition-colors"
            style={{ color: currentPage <= 1 ? '#ccc' : '#555', minWidth: 90, cursor: currentPage <= 1 ? 'default' : 'pointer' }}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>‹</span>
            <span className="text-[11px] tracking-[0.15em] uppercase hidden sm:block">Anterior</span>
          </button>

          {isLoading ? (
            <span style={{ color: '#ccc', fontSize: 14 }}>· · ·</span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1, gap: 3 }}>
              <span style={{ fontSize: 15, color: '#111', fontWeight: 300, letterSpacing: '0.03em' }}>
                {currentPage}
                <span style={{ color: '#ddd', margin: '0 5px' }}>/</span>
                <span style={{ color: '#aaa', fontSize: 13 }}>{numPages}</span>
              </span>
              <span style={{ fontSize: 9, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#bbb' }}>página</span>
            </div>
          )}

          <button onClick={nextPage} disabled={!numPages || currentPage >= numPages || isLoading}
            className="flex items-center gap-2 justify-end transition-colors"
            style={{ color: currentPage >= numPages ? '#ccc' : '#555', minWidth: 90, cursor: currentPage >= numPages ? 'default' : 'pointer' }}>
            <span className="text-[11px] tracking-[0.15em] uppercase hidden sm:block">Siguiente</span>
            <span style={{ fontSize: 20, lineHeight: 1 }}>›</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default PDFReader
