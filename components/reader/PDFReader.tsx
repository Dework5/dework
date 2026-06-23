'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import * as pdfjsLib from 'pdfjs-dist'
import type { PreRenderedImages } from '@/lib/types'

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@' + pdfjsLib.version + '/build/pdf.worker.min.js'

interface PDFReaderProps {
  pdfUrl: string
  issueId?: string
  totalPages?: number
  coverUrl?: string
  backUrl?: string
  downloadUrl?: string
  publicationName?: string
  issueTitle?: string
  preRendered?: PreRenderedImages | null
}

type RenderTaskLike = { cancel: () => void }

export function PDFReader({
  pdfUrl, issueId, totalPages,
  backUrl, downloadUrl, publicationName, issueTitle,
}: PDFReaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [numPages, setNumPages] = useState(totalPages || 0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const renderTaskRef = useRef<RenderTaskLike | null>(null)

  useEffect(() => {
    if (!issueId) return
    try {
      const key = 'dw_session_id'
      let sid = sessionStorage.getItem(key)
      if (!sid) { sid = crypto.randomUUID(); sessionStorage.setItem(key, sid) }
      fetch('/api/track-view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId, sessionId: sid }),
      }).catch(() => {})
    } catch (_) {}
  }, [issueId])

  useEffect(() => {
    setIsLoading(true)
    setError(null)
    const task = pdfjsLib.getDocument({
      url: pdfUrl,
      cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
      cMapPacked: true,
    })
    task.promise
      .then((doc) => { setPdf(doc); setNumPages(doc.numPages); setIsLoading(false) })
      .catch(() => { setError('No se pudo cargar la revista. Por favor, intenta de nuevo.'); setIsLoading(false) })
    return () => { task.destroy().catch(() => {}) }
  }, [pdfUrl])

  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdf || !canvasRef.current) return
    if (renderTaskRef.current) { renderTaskRef.current.cancel(); renderTaskRef.current = null }
    try {
      const page = await pdf.getPage(pageNum)
      const canvas = canvasRef.current
      if (!canvas) return
      const maxWidth = Math.min(window.innerWidth - 32, 900)
      const base = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: maxWidth / base.width })
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const task = page.render({ canvasContext: ctx, viewport })
      renderTaskRef.current = task
      await task.promise
    } catch (err: unknown) {
      const e = err as { name?: string }
      if (e?.name !== 'RenderingCancelledException') console.error('Render error:', err)
    }
  }, [pdf])

  useEffect(() => { if (pdf) renderPage(currentPage) }, [pdf, currentPage, renderPage])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') setCurrentPage((p) => Math.min(p + 1, numPages))
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') setCurrentPage((p) => Math.max(p - 1, 1))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [numPages])

  const prev = () => setCurrentPage((p) => Math.max(p - 1, 1))
  const next = () => setCurrentPage((p) => Math.min(p + 1, numPages))
  const headerTitle = [publicationName, issueTitle].filter(Boolean).join(' ')

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur border-b border-dw-border h-14 flex items-center px-6 gap-4">
          {backUrl && (
            <Link href={backUrl} className="text-dw-muted text-[11px] tracking-[0.15em] uppercase hover:text-dw-text transition-colors">
              ← Volver
            </Link>
          )}
        </div>
        <div className="text-center space-y-4 px-6 mt-14">
          <p className="text-dw-muted">{error}</p>
          <button onClick={() => window.location.reload()} className="text-dw-sub text-sm underline hover:text-dw-text transition-colors">
            REINTENTAR
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-black">
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur border-b border-dw-border h-14 flex items-center px-6 gap-4">
        {backUrl && (
          <Link href={backUrl} className="text-dw-muted text-[11px] tracking-[0.15em] uppercase hover:text-dw-text transition-colors">
            ← Volver
          </Link>
        )}
        {headerTitle && (
          <>
            <span className="text-dw-border">|</span>
            <span className="text-dw-muted text-[11px] tracking-[0.1em] uppercase flex-1 truncate">{headerTitle}</span>
          </>
        )}
        {downloadUrl && (
          <a href={downloadUrl} download className="text-dw-muted text-[11px] tracking-[0.15em] uppercase hover:text-dw-text transition-colors">
            Descargar ↓
          </a>
        )}
      </div>
      <div className="flex-1 flex items-start justify-center pt-20 pb-24 px-4">
        {isLoading ? (
          <div className="flex flex-col items-center gap-4 pt-12">
            <div className="w-48 h-64 md:w-64 md:h-80 bg-dw-card animate-pulse" />
            <p className="text-dw-muted text-sm animate-pulse">Cargando revista...</p>
          </div>
        ) : (
          <canvas ref={canvasRef} className="shadow-2xl max-w-full" style={{ display: 'block' }} />
        )}
      </div>
      {!isLoading && numPages > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur border-t border-dw-border flex items-center justify-center gap-6 py-4 z-40">
          <button onClick={prev} disabled={currentPage === 1} className="text-dw-muted text-[11px] tracking-[0.15em] uppercase hover:text-dw-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-4 py-2">
            ← Anterior
          </button>
          <span className="text-dw-sub text-[11px] tracking-[0.15em] min-w-[5rem] text-center">
            {currentPage} / {numPages}
          </span>
          <button onClick={next} disabled={currentPage === numPages} className="text-dw-muted text-[11px] tracking-[0.15em] uppercase hover:text-dw-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-4 py-2">
            Siguiente →
          </button>
        </div>
      )}
    </div>
  )
}

export default PDFReader
