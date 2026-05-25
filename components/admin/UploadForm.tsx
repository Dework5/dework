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
  const [issueNumber,   setIssueNumber]   = useState('')
  const [title,         setTitle]         = useState('')
  const [coverFile,     setCoverFile]     = useState<File | null>(null)
  const [pdfFile,       setPdfFile]       = useState<File | null>(null)
  const [isPublished,   setIsPublished]   = useState(true)
  const [progress,      setProgress]      = useState(0)
  const [progressLabel, setProgressLabel] = useState('')
  const [status,        setStatus]        = useState<'idle'|'uploading'|'success'|'error'>('idle')
  const [message,       setMessage]       = useState('')
  const [resultUrl,     setResultUrl]     = useState('')

  const coverInputRef = useRef<HTMLInputElement>(null)
  const pdfInputRef   = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!publicationId || !issueNumber || !title || !coverFile || !pdfFile) {
      setMessage('Completá todos los campos.')
      setStatus('error')
      return
    }

    setStatus('uploading')
    setProgress(5)
    setProgressLabel('Preparando subida...')

    const pw = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || ''
    const coverExt = coverFile.name.split('.').pop() || 'jpg'

    try {
      // 1. Obtener URLs firmadas
      setProgressLabel('Obteniendo URLs de subida...')
      const urlsRes = await fetch('/api/admin/get-upload-urls', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: pw },
        body:    JSON.stringify({ publicationId, issueNumber, coverExt }),
      })
      if (!urlsRes.ok) {
        const err = await urlsRes.json()
        throw new Error(err.error || 'Error obteniendo URLs.')
      }
      const { cover: coverUpload, pdf: pdfUpload } = await urlsRes.json()
      setProgress(15)

      // 2. Subir portada directo a Supabase
      setProgressLabel('Subiendo portada...')
      const coverRes = await fetch(coverUpload.signedUrl, {
        method:  'PUT',
        headers: { 'Content-Type': coverFile.type || 'image/jpeg' },
        body:    coverFile,
      })
      if (!coverRes.ok) throw new Error('Error subiendo la portada (' + coverRes.status + ')')
      setProgress(50)

      // 3. Subir PDF directo a Supabase (sin limite de Vercel)
      setProgressLabel('Subiendo PDF...')
      const pdfRes = await fetch(pdfUpload.signedUrl, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        body:    pdfFile,
      })
      if (!pdfRes.ok) throw new Error('Error subiendo el PDF (' + pdfRes.status + ')')
      setProgress(82)

      // 4. Crear registro en la base de datos
      setProgressLabel('Guardando edicion...')
      const createRes = await fetch('/api/admin/create-issue', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: pw },
        body:    JSON.stringify({
          publicationId,
          issueNumber: parseInt(issueNumber),
          title,
          coverPath: coverUpload.path,
          pdfPath:   pdfUpload.path,
          isPublished,
        }),
      })
      const data = await createRes.json()
      if (!createRes.ok) throw new Error(data.error || 'Error guardando la edicion.')

      setProgress(100)
      setStatus('success')
      setMessage('Edicion publicada correctamente!')
      setResultUrl(data.url || '')
      setPublicationId('')
      setIssueNumber('')
      setTitle('')
      setCoverFile(null)
      setPdfFile(null)
      if (coverInputRef.current) coverInputRef.current.value = ''
      if (pdfInputRef.current)   pdfInputRef.current.value   = ''

    } catch (err) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'Error inesperado. Intenta de nuevo.')
      setProgress(0)
      setProgressLabel('')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className={labelCls}>Publicacion *</label>
        <select value={publicationId} onChange={(e) => setPublicationId(e.target.value)} className={inputCls} required>
          <option value="">Selecciona una publicacion</option>
          {publications.map((pub) => (
            <option key={pub.id} value={pub.id}>{pub.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls}>Numero de edicion *</label>
        <input type="number" value={issueNumber} onChange={(e) => setIssueNumber(e.target.value)} className={inputCls} placeholder="139" required />
      </div>
      <div>
        <label className={labelCls}>Titulo *</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="SDLR #139" required />
      </div>
      <div>
        <label className={labelCls}>PDF de la revista *</label>
        <input ref={pdfInputRef} type="file" accept="application/pdf" onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
          className="w-full border border-[#E5E5E5] rounded-lg px-4 py-3 text-[#444] text-sm focus:outline-none focus:border-[#080808] file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-[#F0F0F0] file:text-xs file:cursor-pointer" required />
        <p className="text-[#AAA] text-xs mt-1">PDF - Sin limite de tamanio (sube directo a Supabase)</p>
      </div>
      <div>
        <label className={labelCls}>Imagen de portada *</label>
        <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
          className="w-full border border-[#E5E5E5] rounded-lg px-4 py-3 text-[#444] text-sm focus:outline-none focus:border-[#080808] file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-[#F0F0F0] file:text-xs file:cursor-pointer" required />
        <p className="text-[#AAA] text-xs mt-1">JPG o PNG - Recomendado 800x1100px</p>
      </div>
      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} className="w-4 h-4 accent-[#080808]" />
        <span className="text-sm text-[#444]">Publicar inmediatamente</span>
      </label>
      {status === 'uploading' && (
        <div className="space-y-2">
          <div className="h-1.5 bg-[#F0F0F0] rounded-full overflow-hidden">
            <div className="h-full bg-[#080808] transition-all duration-500 rounded-full" style={{ width: progress + '%' }} />
          </div>
          <p className="text-[#888] text-xs">{progressLabel} {progress}%</p>
        </div>
      )}
      {status === 'success' && (
        <div className="flex items-start gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg p-4">
          <CheckCircle size={16} className="mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm">{message}</p>
            {resultUrl && <a href={resultUrl} className="text-xs underline mt-1 block" target="_blank" rel="noreferrer">Ver edicion</a>}
          </div>
        </div>
      )}
      {status === 'error' && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg p-4">
          <AlertCircle size={16} className="flex-shrink-0" />
          <p className="text-sm">{message}</p>
        </div>
      )}
      <button type="submit" disabled={status === 'uploading'}
        className="flex items-center gap-2 bg-[#080808] text-white py-3 px-8 rounded-lg text-sm font-medium hover:bg-[#333] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
        <Upload size={16} />
        {status === 'uploading' ? progressLabel : 'Publicar edicion'}
      </button>
    </form>
  )
}
