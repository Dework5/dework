'use client'

import { useState, useRef } from 'react'
import { Upload, CheckCircle, AlertCircle } from 'lucide-react'
import { Publication } from '@/lib/types'

interface UploadFormProps {
  publications: Publication[]
}

export function UploadForm({ publications }: UploadFormProps) {
  const [publicationId, setPublicationId] = useState('')
  const [issueNumber, setIssueNumber] = useState('')
  const [title, setTitle] = useState('')
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [isPublished, setIsPublished] = useState(true)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [resultUrl, setResultUrl] = useState('')

  const coverInputRef = useRef<HTMLInputElement>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!publicationId || !issueNumber || !title || !coverFile || !pdfFile) {
      setMessage('Completá todos los campos.')
      setStatus('error')
      return
    }

    setStatus('uploading')
    setProgress(10)

    const formData = new FormData()
    formData.append('publicationId', publicationId)
    formData.append('issueNumber', issueNumber)
    formData.append('title', title)
    formData.append('cover', coverFile)
    formData.append('pdf', pdfFile)
    formData.append('isPublished', String(isPublished))

    setProgress(30)

    try {
      const password = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || ''
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: { Authorization: password },
        body: formData,
      })

      setProgress(90)
      const data = await res.json()

      if (res.ok) {
        setProgress(100)
        setStatus('success')
        setMessage('¡Edición subida correctamente!')
        setResultUrl(data.url || '')
        // Reset form
        setPublicationId('')
        setIssueNumber('')
        setTitle('')
        setCoverFile(null)
        setPdfFile(null)
        if (coverInputRef.current) coverInputRef.current.value = ''
        if (pdfInputRef.current) pdfInputRef.current.value = ''
      } else {
        setStatus('error')
        setMessage(data.error || 'Error al subir la edición.')
      }
    } catch {
      setStatus('error')
      setMessage('Error de red. Intentá de nuevo.')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      {/* Publicación */}
      <div className="space-y-2">
        <label className="block text-xs font-body text-text-secondary uppercase tracking-wider">
          Publicación
        </label>
        <select
          value={publicationId}
          onChange={(e) => setPublicationId(e.target.value)}
          className="w-full bg-surface-elevated border border-border rounded-sm px-4 py-3 text-text-primary font-body text-sm focus:outline-none focus:border-text-secondary transition-colors"
          required
        >
          <option value="">Seleccioná una publicación</option>
          {publications.map((pub) => (
            <option key={pub.id} value={pub.id}>
              {pub.name}
            </option>
          ))}
        </select>
      </div>

      {/* Número */}
      <div className="space-y-2">
        <label className="block text-xs font-body text-text-secondary uppercase tracking-wider">
          Número de edición
        </label>
        <input
          type="number"
          value={issueNumber}
          onChange={(e) => setIssueNumber(e.target.value)}
          className="w-full bg-surface-elevated border border-border rounded-sm px-4 py-3 text-text-primary font-body text-sm focus:outline-none focus:border-text-secondary transition-colors"
          placeholder="140"
          required
        />
      </div>

      {/* Título */}
      <div className="space-y-2">
        <label className="block text-xs font-body text-text-secondary uppercase tracking-wider">
          Título
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-surface-elevated border border-border rounded-sm px-4 py-3 text-text-primary font-body text-sm focus:outline-none focus:border-text-secondary transition-colors"
          placeholder="SDLR #140 — Junio 2026"
          required
        />
      </div>

      {/* Portada */}
      <div className="space-y-2">
        <label className="block text-xs font-body text-text-secondary uppercase tracking-wider">
          Portada (JPG/PNG)
        </label>
        <input
          ref={coverInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
          className="w-full bg-surface-elevated border border-border rounded-sm px-4 py-3 text-text-secondary font-body text-sm focus:outline-none file:mr-4 file:py-1 file:px-3 file:rounded-sm file:border-0 file:bg-surface file:text-text-secondary file:text-xs file:cursor-pointer"
          required
        />
      </div>

      {/* PDF */}
      <div className="space-y-2">
        <label className="block text-xs font-body text-text-secondary uppercase tracking-wider">
          PDF de la revista
        </label>
        <input
          ref={pdfInputRef}
          type="file"
          accept="application/pdf"
          onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
          className="w-full bg-surface-elevated border border-border rounded-sm px-4 py-3 text-text-secondary font-body text-sm focus:outline-none file:mr-4 file:py-1 file:px-3 file:rounded-sm file:border-0 file:bg-surface file:text-text-secondary file:text-xs file:cursor-pointer"
          required
        />
      </div>

      {/* Publicar inmediatamente */}
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={isPublished}
          onChange={(e) => setIsPublished(e.target.checked)}
          className="w-4 h-4 accent-primary"
        />
        <span className="text-sm font-body text-text-secondary">
          Publicar inmediatamente
        </span>
      </label>

      {/* Barra de progreso */}
      {status === 'uploading' && (
        <div className="space-y-2">
          <div className="h-1 bg-surface-elevated rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-text-muted text-xs font-body">
            Subiendo... {progress}%
          </p>
        </div>
      )}

      {/* Mensaje resultado */}
      {status === 'success' && (
        <div className="flex items-start gap-2 text-green-400 bg-green-400/10 border border-green-400/20 rounded-sm p-3">
          <CheckCircle size={16} className="mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-body">{message}</p>
            {resultUrl && (
              <a href={resultUrl} className="text-xs underline mt-1 block" target="_blank" rel="noreferrer">
                Ver edición →
              </a>
            )}
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center gap-2 text-primary bg-primary/10 border border-primary/20 rounded-sm p-3">
          <AlertCircle size={16} className="flex-shrink-0" />
          <p className="text-sm font-body">{message}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={status === 'uploading'}
        className="flex items-center gap-2 bg-primary text-white py-3 px-8 rounded-sm font-body font-medium tracking-wide hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
      >
        <Upload size={16} />
        {status === 'uploading' ? 'Subiendo...' : 'Subir edición'}
      </button>
    </form>
  )
}
