'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import * as pdfjsLib from 'pdfjs-dist'
import type { PreRenderedImages } from '@/lib/types'
import { ReaderControls } from './ReaderControls'

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
  const [scale, setScale] = useState(1.5)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const renderTaskRef = useRef<RenderTaskLike | null>(null)

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
      cMapUrl: '//cdnjs.cloudflare.com/ajax/libs/pdf.js/' + pdfjsLib.version + '/cmaps/',
      cMapPacked: true,
    })
    task.promise
      .then((doc) => { setPdf(doc); setNumPages(doc.numPages); setIsLoading(false) })
      .catch(() => { setError('No se pudo cargar la revista. Intentá de nuevo.'); setIsLoading(false) })
    return () => { task.destroy().catch(() => {}) }
  }, [pdfUrl])

  const renderPage = useCallback(async (pageNum: number, currentScale: number) => {
    if (!pdf || !canvasRef.current) return
    if (renderTaskRef.current) { renderTaskRef.current.cancel(); renderTaskRef.current = null }
    try {
      const page = await pdf.getPage(pageNum)
      const canvas = canvasRef.current
      if (!canvas) return
      const viewport = page.getViewport({ scale: currentScale })
      canvas.height = viewport.height
      canvas.width = viewport.width
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const task = page.render({ canvasContext: ctx, viewport })
      renderTaskRef.current = task
      await task.promise
      const sid = sessionStorage.getItem('dw_session_id') || ''
      fetch('/api/track-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId, sessionId: sid, pageNumber: pageNum }),
      }).catch(() => {})
    } catch (err: unknown) {
      const e = err as { name?: string }
      if (e?.name !== 'RenderingCancelledException') console.error('Render error:', err)
    }
  }, [pdf, issueId])

  useEffect(() => { if (pdf) renderPage(currentPage, scale) }, [pdf, currentPage, scale, renderPage])

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
  const goTo = (p: number) => setCurrentPage(p)
  const zoomIn = () => setScale((s) => Math.min(s + 0.2, 3))
  const zoomOut = () => setScale((s) => Math.max(s - 0.2, 0.5))
  const headerTitle = [publicationName, issueTitle].filter(Boolean).join(' ')

  if (error) {
    return (
      <div className="relative bg-black min-h-screen flex flex-col">
        <div className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur border-b border-dw-border h-14 flex items-center px-6 gap-4">
          {backUrl && (
            <Link href={backUrl} className="text-dw-muted text-[11px] tracking-[0.15em] uppercase hover:text-dw-text transition-colors">
              ← Volver
            </Link>
          )}
        </div>
        <div className="flex-1 flex items-center justify-center pt-14">
          <div className="text-center space-y-4 px-6">
            <p className="text-dw-muted">{error}</p>
            <button onClick={() => window.location.reload()} className="text-dw-sub text-sm underline hover:text-dw-text transition-colors">REINTENTAR</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative bg-black min-h-screen flex flex-col">
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
      <div className="flex-1 overflow-auto flex items-start justify-center py-8 pb-24 pt-20">
        {isLoading ? (
          <div className="flex flex-col items-center gap-4 pt-16">
            <div className="w-48 h-64 md:w-64 md:h-80 bg-dw-card animate-pulse" />
            <p className="text-dw-muted font-body text-sm animate-pulse">Cargando revista...</p>
          </div>
        ) : (
          <canvas ref={canvasRef} className="shadow-2xl max-w-full" style={{ display: 'block' }} />
        )}
      </div>
      {!isLoading && (
        <div className="fixed top-20 right-4 flex flex-col gap-2 z-50">
          <button onClick={zoomIn} className="w-10 h-10 bg-black/80 border border-dw-border flex items-center justify-center text-dw-muted hover:text-dw-text hover:bg-dw-card transition-colors" aria-label="Zoom in">+</button>
          <button onClick={zoomOut} className="w-10 h-10 bg-black/80 border border-dw-border flex items-center justify-center text-dw-muted hover:text-dw-text hover:bg-dw-card transition-colors" aria-label="Zoom out">−</button>
        </div>
      )}
      <ReaderControls
        currentPage={currentPage}
        numPages={numPages}
        onPrev={prev}
        onNext={next}
        onGoTo={goTo}
        isLoading={isLoading}
      />
    </div>
  )
}

export default PDFReader
