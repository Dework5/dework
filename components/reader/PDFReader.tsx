'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { ReaderControls } from './ReaderControls'

pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

interface PDFReaderProps {
  pdfUrl: string
  issueId: string
  totalPages?: number
}

export function PDFReader({ pdfUrl, issueId, totalPages }: PDFReaderProps) {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [pdf,          setPdf]          = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [currentPage,  setCurrentPage]  = useState(1)
  const [numPages,     setNumPages]     = useState(totalPages || 0)
  const [scale,        setScale]        = useState(1.5)
  const [isLoading,    setIsLoading]    = useState(true)
  const [pageChanging, setPageChanging] = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null)

  // ── Scale automático al ancho del viewport ──────────────────────
  const calcScale = useCallback(() => {
    const maxW = Math.min(window.innerWidth, 900)
    const s    = Math.max(0.4, (maxW - 40) / 595)
    setScale(Math.min(s, 2.4))
  }, [])

  useEffect(() => {
    calcScale()
    window.addEventListener('resize', calcScale)
    return () => window.removeEventListener('resize', calcScale)
  }, [calcScale])

  // ── Session tracking ─────────────────────────────────────────────
  useEffect(() => {
    let sid = sessionStorage.getItem('dework_session')
    if (!sid) { sid = crypto.randomUUID(); sessionStorage.setItem('dework_session', sid) }
    fetch('/api/track-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issueId, sessionId: sid }),
    }).catch(() => {})
  }, [issueId])

  // ── Cargar PDF ───────────────────────────────────────────────────
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

  // ── Renderizar página ────────────────────────────────────────────
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

  // ── Navegación ───────────────────────────────────────────────────
  const goTo = useCallback((p: number) => {
    if (p < 1 || p > numPages || isLoading) return
    setPageChanging(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setTimeout(() => { setCurrentPage(p); setPageChanging(false) }, 140)
  }, [numPages, isLoading])

  const prevPage = () => goTo(currentPage - 1)
  const nextPage = () => goTo(currentPage + 1)
  const zoomIn   = () => setScale(s => Math.min(s + 0.25, 3))
  const zoomOut  = () => setScale(s => Math.max(s - 0.25, 0.5))

  // ── Teclado ──────────────────────────────────────────────────────
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

  // ── Swipe mobile ─────────────────────────────────────────────────
  const touchStartX = useRef(0)
  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX }
  const onTouchEnd   = (e: React.TouchEvent) => {
    const dx = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(dx) > 48) { dx > 0 ? nextPage() : prevPage() }
  }

  const progress = numPages > 1 ? ((currentPage - 1) / (numPages - 1)) * 100 : 0

  // ── Error ────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F0EDE8]">
        <div className="text-center space-y-4 px-6">
          <p className="text-gray-500 text-base">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-[#111] text-sm tracking-widest uppercase border-b border-[#111]/20 hover:border-[#111] transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="relative min-h-screen flex flex-col select-none"
      style={{ background: '#F0EDE8' }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* ── Barra de progreso de lectura ── */}
      <div className="fixed top-14 left-0 right-0 z-40 h-[3px] bg-black/5">
        <div
          className="h-full transition-all duration-700 ease-out"
          style={{ width: `${progress}%`, background: '#C5A56B' }}
        />
      </div>

      {/* ── Área de lectura ── */}
      <div className="flex-1 flex items-start justify-center px-4 py-10 pb-28">
        {isLoading ? (
          <div className="flex flex-col items-center gap-5 pt-16 w-full max-w-[640px]">
            <div
              className="w-full animate-pulse rounded-sm"
              style={{
                aspectRatio: '595/842',
                background: 'linear-gradient(135deg, #E8E4DF 25%, #EBE8E3 50%, #E8E4DF 75%)',
                backgroundSize: '400% 400%',
                maxWidth: Math.min(595 * scale, (typeof window !== 'undefined' ? window.innerWidth : 600) - 40),
              }}
            />
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#C5A56B] animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-[#C5A56B] animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-[#C5A56B] animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <p className="text-gray-400 text-[11px] tracking-[0.3em] uppercase">
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
              className="max-w-full block"
              style={{
                borderRadius: '1px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08), 0 8px 40px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.06)',
              }}
            />
          </div>
        )}
      </div>

      {/* ── Zoom (lado derecho, solo desktop) ── */}
      {!isLoading && (
        <div className="fixed right-4 top-1/2 -translate-y-1/2 hidden md:flex flex-col gap-1.5 z-50">
          <button
            onClick={zoomIn}
            className="w-8 h-8 bg-white/80 backdrop-blur-sm border border-black/8 text-gray-500 hover:text-gray-900 hover:bg-white transition-all text-base flex items-center justify-center rounded shadow-sm"
            aria-label="Zoom in"
          >+</button>
          <button
            onClick={zoomOut}
            className="w-8 h-8 bg-white/80 backdrop-blur-sm border border-black/8 text-gray-500 hover:text-gray-900 hover:bg-white transition-all text-base flex items-center justify-center rounded shadow-sm"
            aria-label="Zoom out"
          >−</button>
        </div>
      )}

      {/* ── Controles de navegación ── */}
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
