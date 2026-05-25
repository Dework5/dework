'use client'

import { useState, useRef } from 'react'
import { Upload, CheckCircle, AlertCircle } from 'lucide-react'
import { Publication } from '@/lib/types'

interface UploadFormProps {
  publications: Publication[]
}

const inputCls = 'w-full border border-[#E5E5E5] rounded-lg px-4 py-3 text-[#080808] text-sm focus:outline-none focus:border-[#080808] transition-colors bg-white'
const labelCls = 'block text-[#333] text-xs font-semibold uppercase tracking-wider mb-2'

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
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Publicación */}
      <div>
        <label className={labelCls}>Publicación *</label>
        <select value={publicationId} onChange={(e) => setPublicationId(e.target.value)}
          className={inputCls} required>
          <option value="">Seleccioná una publicación</option>
          {publications.map((pub) => (
            <option key={pub.id} value={pub.id}>{pub.name}</option>
          ))}
        </select>
      </div>

      {/* Número de edición */}
      <div>
        <label className={labelCls}>Número de edición *</label>
        <input type="number" value={issueNumber} onChange={(e) => setIssueNumber(e.target.value)}
          className={inputCls} placeholder="140" required />
      </div>

      {/* Título */}
      <div>
        <label className={labelCls}>Título *</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
          className={inputCls} placeholder="SDLR #140 — Junio 2026" required />
      </div>

      {/* PDF */}
      <div>
        <label className={labelCls}>PDF de la revista *</label>
        <input ref={pdfInputRef} type="file" accept="application/pdf"
          onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
          className="w-full border border-[#E5E5E5] rounded-lg px-4 py-3 text-[#444] text-sm focus:outline-none focus:border-[#080808] transition-colors file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-[#F0F0F0] file:text-[#444] file:text-xs file:cursor-pointer"
          required />
        <p className="text-[#AAA] text-xs mt-1">PDF · Máximo 50MB</p>
      </div>

      {/* Portada */}
      <div>
        <label className={labelCls}>Imagen de portada *</label>
        <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
          className="w-full border border-[#E5E5E5] rounded-lg px-4 py-3 text-[#444] text-sm focus:outline-none focus:border-[#080808] transition-colors file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-[#F0F0F0] file:text-[#444] file:text-xs file:cursor-pointer"
          required />
        <p className="text-[#AAA] text-xs mt-1">JPG o PNG · Recomendado 800×1100px</p>
      </div>

      {/* Publicar inmediatamente */}
      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)}
          className="w-4 h-4 accent-[#080808]" />
        <span className="text-sm text-[#444]">Publicar inmediatamente</span>
      </label>

      {/* Barra de progreso */}
      {status === 'uploading' && (
        <div className="space-y-2">
          <div className="h-1.5 bg-[#F0F0F0] rounded-full overflow-hidden">
            <div className="h-full bg-[#080808] transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-[#888] text-xs">Subiendo... {progress}%</p>
        </div>
      )}

      {/* Success */}
      {status === 'success' && (
        <div className="flex items-start gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg p-4">
          <CheckCircle size={16} className="mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm">{message}</p>
            {resultUrl && (
              <a href={resultUrl} className="text-xs underline mt-1 block" target="_blank" rel="noreferrer">
                Ver edición →
              </a>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg p-4">
          <AlertCircle size={16} className="flex-shrink-0" />
          <p className="text-sm">{message}</p>
        </div>
      )}

      <button type="submit" disabled={status === 'uploading'}
        className="flex items-center gap-2 bg-[#080808] text-white py-3 px-8 rounded-lg text-sm font-medium hover:bg-[#333] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
        <Upload size={16} />
        {status === 'uploading' ? 'Subiendo...' : 'Publicar edición'}
      </button>
    </form>
  )
}
