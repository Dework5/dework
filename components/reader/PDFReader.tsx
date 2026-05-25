'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { ReaderControls } from './ReaderControls'

// Configurar el worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

interface PDFReaderProps {
  pdfUrl: string
  issueId: string
  totalPages?: number
}

export function PDFReader({ pdfUrl, issueId, totalPages }: PDFReaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [numPages, setNumPages] = useState(totalPages || 0)
  const [scale, setScale] = useState(1.5)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null)

  // Calcular scale según viewport
  useEffect(() => {
    const calcScale = () => {
      const w = window.innerWidth
      const computed = Math.min(1.5, (w - 32) / 595)
      setScale(Math.max(0.5, computed))
    }
    calcScale()
    window.addEventListener('resize', calcScale)
    return () => window.removeEventListener('resize', calcScale)
  }, [])

  // Session ID tracking
  useEffect(() => {
    let sessionId = sessionStorage.getItem('dework_session')
    if (!sessionId) {
      sessionId = crypto.randomUUID()
      sessionStorage.setItem('dework_session', sessionId)
    }
    // Registrar vista de edición
    fetch('/api/track-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issueId, sessionId }),
    }).catch(() => {})
  }, [issueId])

  // Cargar PDF
  useEffect(() => {
    setIsLoading(true)
    setError(null)

    const loadingTask = pdfjsLib.getDocument({
      url: pdfUrl,
      cMapUrl: `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/cmaps/`,
      cMapPacked: true,
    })

    loadingTask.promise
      .then((pdfDoc) => {
        setPdf(pdfDoc)
        setNumPages(pdfDoc.numPages)
        setIsLoading(false)
      })
      .catch(() => {
        setError('No se pudo cargar el PDF. Por favor, intentá de nuevo.')
        setIsLoading(false)
      })

    return () => {
      loadingTask.destroy().catch(() => {})
    }
  }, [pdfUrl])

  // Renderizar página
  const renderPage = useCallback(
    async (pageNum: number, currentScale: number) => {
      if (!pdf || !canvasRef.current) return

      // Cancelar render anterior
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel()
      }

      try {
        const page = await pdf.getPage(pageNum)
        const viewport = page.getViewport({ scale: currentScale })
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        canvas.height = viewport.height
        canvas.width = viewport.width

        const renderTask = page.render({ canvasContext: ctx, viewport, canvas: canvas })
        renderTaskRef.current = renderTask

        await renderTask.promise

        // Trackear página vista
        const sessionId = sessionStorage.getItem('dework_session') || ''
        fetch('/api/track-page', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ issueId, sessionId, pageNumber: pageNum }),
        }).catch(() => {})
      } catch (err: unknown) {
        // Ignorar cancelaciones
        if ((err as { name?: string })?.name !== 'RenderingCancelledException') {
          console.error('Error rendering page', err)
        }
      }
    },
    [pdf, issueId]
  )

  useEffect(() => {
    if (pdf) {
      renderPage(currentPage, scale)
    }
  }, [pdf, currentPage, scale, renderPage])

  const prevPage = () => {
    if (currentPage > 1) setCurrentPage((p) => p - 1)
  }

  const nextPage = () => {
    if (currentPage < numPages) setCurrentPage((p) => p + 1)
  }

  const zoomIn = () => setScale((s) => Math.min(s + 0.2, 3))
  const zoomOut = () => setScale((s) => Math.max(s - 0.2, 0.5))

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-dw-muted font-body">
        <div className="text-center space-y-4">
          <p className="text-lg">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-dw-sub hover:text-dw-text transition-colors text-sm"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative bg-black min-h-screen flex flex-col">
      {/* Canvas area */}
      <div className="flex-1 overflow-auto flex items-start justify-center py-8 pb-24">
        {isLoading ? (
          <div className="flex flex-col items-center gap-4 pt-24">
            <div className="w-48 h-64 md:w-64 md:h-80 bg-dw-card animate-pulse" />
            <p className="text-dw-muted font-body text-sm animate-pulse">
              Cargando revista...
            </p>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className="shadow-2xl max-w-full"
            style={{ display: 'block' }}
          />
        )}
      </div>

      {/* Controles zoom flotantes */}
      {!isLoading && (
        <div className="fixed top-20 right-4 flex flex-col gap-2 z-50">
          <button
            onClick={zoomIn}
            className="w-10 h-10 bg-black/80 border border-dw-border flex items-center justify-center text-dw-muted hover:text-dw-text hover:bg-dw-card transition-colors"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            onClick={zoomOut}
            className="w-10 h-10 bg-black/80 border border-dw-border flex items-center justify-center text-dw-muted hover:text-dw-text hover:bg-dw-card transition-colors"
            aria-label="Zoom out"
          >
            −
          </button>
          <a
            href={pdfUrl}
            download
            className="w-10 h-10 bg-black/80 border border-dw-border flex items-center justify-center text-dw-muted hover:text-dw-text hover:bg-dw-card transition-colors"
            aria-label="Descargar PDF"
            title="Descargar PDF"
          >
            ↓
          </a>
        </div>
      )}

      {/* Barra de controles inferior */}
      <ReaderControls
        currentPage={currentPage}
        numPages={numPages}
        onPrev={prevPage}
        onNext={nextPage}
        isLoading={isLoading}
      />
    </div>
  )
}

export default PDFReader
