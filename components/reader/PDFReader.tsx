'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { ReaderControls } from './ReaderControls'

// Worker CDN compatible con pdfjs v5
pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

interface PDFReaderProps {
  pdfUrl: string
  issueId: string
  totalPages?: number
}

export function PDFReader({ pdfUrl, issueId, totalPages }: PDFReaderProps) {
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [pdf,         setPdf]         = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [numPages,    setNumPages]    = useState(totalPages || 0)
  const [scale,       setScale]       = useState(1.5)
  const [isLoading,   setIsLoading]   = useState(true)
  const [pageChanging,setPageChanging]= useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null)

  // --- Scale automático al ancho del viewport ---
  const calcScale = useCallback(() => {
    const w = Math.min(window.innerWidth, 960) // max 960px
    const s = Math.max(0.4, (w - 32) / 595)   // 595 = ancho A4 en pts
    setScale(Math.min(s, 2.2))
  }, [])

  useEffect(() => {
    calcScale()
    window.addEventListener('resize', calcScale)
    return () => window.removeEventListener('resize', calcScale)
  }, [calcScale])

  // --- Session tracking ---
  useEffect(() => {
    let sid = sessionStorage.getItem('dework_session')
    if (!sid) { sid = crypto.randomUUID(); sessionStorage.setItem('dework_session', sid) }
    fetch('/api/track-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issueId, sessionId: sid }),
    }).catch(() => {})
  }, [issueId])

  // --- Cargar PDF ---
  useEffect(() => {
    setIsLoading(true)
    setError(null)
    const task = pdfjsLib.getDocument({
      url: pdfUrl,
      cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
      cMapPacked: true,
    })
    task.promise
      .then(doc => { setPdf(doc); setNumPages(doc.numPages); setIsLoading(false) })
      .catch(() => { setError('No se pudo cargar el PDF. Intentá de nuevo.'); setIsLoading(false) })
    return () => { task.destroy().catch(() => {}) }
  }, [pdfUrl])

  // --- Renderizar página ---
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

      const task = page.render({ canvasContext: ctx, viewport, canvas })
      renderTaskRef.current = task
      await task.promise

      const sid = sessionStorage.getItem('dework_session') || ''
      fetch('/api/track-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId, sessionId: sid, pageNumber: pageNum }),
      }).catch(() => {})
    } catch (e: unknown) {
      if ((e as { name?: string })?.name !== 'RenderingCancelledException') console.error(e)
    }
  }, [pdf, issueId])

  useEffect(() => {
    if (pdf) renderPage(currentPage, scale)
  }, [pdf, currentPage, scale, renderPage])

  // --- Navegación ---
  const goTo = useCallback((p: number) => {
    if (p < 1 || p > numPages || isLoading) return
    setPageChanging(true)
    setTimeout(() => {
      setCurrentPage(p)
      setPageChanging(false)
    }, 120)
  }, [numPages, isLoading])

  const prevPage = () => goTo(currentPage - 1)
  const nextPage = () => goTo(currentPage + 1)
  const zoomIn   = () => setScale(s => Math.min(s + 0.25, 3))
  const zoomOut  = () => setScale(s => Math.max(s - 0.25, 0.4))

  // --- Teclado ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); nextPage() }
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   { e.preventDefault(); prevPage() }
      if (e.key === '+' || e.key === '=') zoomIn()
      if (e.key === '-')                  zoomOut()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [currentPage, numPages, isLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  // --- Swipe mobile ---
  const touchStartX = useRef(0)
  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX }
  const onTouchEnd   = (e: React.TouchEvent) => {
    const dx = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(dx) > 50) { dx > 0 ? nextPage() : prevPage() }
  }

  // --- Progress % ---
  const progress = numPages > 0 ? ((currentPage - 1) / (numPages - 1)) * 100 : 0

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0d0d0d]">
        <div className="text-center space-y-4 px-6">
          <p className="text-white/60 text-base">{error}</p>
          <button onClick={() => window.location.reload()}
            className="text-[#C5A56B] text-sm tracking-widest uppercase hover:text-white transition-colors">
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="relative bg-[#0d0d0d] min-h-screen flex flex-col select-none"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Barra de progreso de lectura */}
      <div className="fixed top-14 left-0 right-0 z-40 h-px bg-white/5">
        <div
          className="h-full bg-[#C5A56B] transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Área del canvas */}
      <div className="flex-1 overflow-auto flex items-start justify-center py-10 pb-28 px-4">
        {isLoading ? (
          // Skeleton de carga
          <div className="flex flex-col items-center gap-6 pt-16">
            <div
              className="animate-pulse rounded-sm"
              style={{
                width:  Math.min(595 * scale, window.innerWidth - 32),
                height: Math.min(842 * scale, (window.innerHeight - 120) * 1.2),
                background: 'linear-gradient(135deg, #1a1a1a 25%, #222 50%, #1a1a1a 75%)',
              }}
            />
            <p className="text-white/30 text-[11px] tracking-[0.25em] uppercase animate-pulse">
              Cargando revista…
            </p>
          </div>
        ) : (
          <div
            className="transition-opacity duration-150"
            style={{ opacity: pageChanging ? 0 : 1 }}
          >
            <canvas
              ref={canvasRef}
              className="rounded-sm max-w-full block"
              style={{
                boxShadow: '0 8px 60px rgba(0,0,0,0.8), 0 2px 20px rgba(0,0,0,0.6)',
              }}
            />
          </div>
        )}
      </div>

      {/* Controles zoom (lado derecho) */}
      {!isLoading && (
        <div className="fixed right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-50">
          <button onClick={zoomIn}
            className="w-9 h-9 bg-black/70 border border-white/10 text-white/50 hover:text-white hover:border-white/30 transition-all text-base flex items-center justify-center rounded-sm backdrop-blur"
            aria-label="Zoom in">+</button>
          <button onClick={zoomOut}
            className="w-9 h-9 bg-black/70 border border-white/10 text-white/50 hover:text-white hover:border-white/30 transition-all text-base flex items-center justify-center rounded-sm backdrop-blur"
            aria-label="Zoom out">−</button>
          <a href={pdfUrl} download
            className="w-9 h-9 bg-black/70 border border-white/10 text-white/50 hover:text-white hover:border-white/30 transition-all text-sm flex items-center justify-center rounded-sm backdrop-blur"
            aria-label="Descargar PDF" title="Descargar PDF">↓</a>
        </div>
      )}

      {/* Controles inferior */}
      <ReaderControls
        currentPage={currentPage}
        numPages={numPages}
        onPrev={prevPage}
        onNext={nextPage}
        onGoTo={goTo}
        isLoading={isLoading}
      />
    </div>
  )
}

export default PDFReader