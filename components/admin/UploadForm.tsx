'use client'

import { useState, useRef } from 'react'
import { Upload, CheckCircle, AlertCircle } from 'lucide-react'
import { Publication } from '@/lib/types'
import { supabase as supabasePublic } from '@/lib/supabase'

interface UploadFormProps {
  publications: Publication[]
}

const inputCls = 'w-full border border-[#E5E5E5] rounded-lg px-4 py-3 text-[#080808] text-sm focus:outline-none focus:border-[#080808] transition-colors bg-white'
const labelCls = 'block text-[#333] text-xs font-semibold uppercase tracking-wider mb-2'

/** Sube el PDF directo a R2 via URL firmada, con progreso real usando XHR. */
function uploadToR2(
  file: File,
  signedUrl: string,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    })
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`Error subiendo el PDF a R2: ${xhr.status} ${xhr.statusText}`))
    })
    xhr.addEventListener('error', () => reject(new Error('Error de red al subir el PDF')))
    xhr.open('PUT', signedUrl)
    xhr.setRequestHeader('Content-Type', 'application/pdf')
    xhr.send(file)
  })
}

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
      setMessage('Completa todos los campos.')
      setStatus('error')
      return
    }

    setStatus('uploading')
    setProgress(5)
    setProgressLabel('Preparando subida...')

    const pw = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || ''
    const coverExt = coverFile.name.split('.').pop() || 'jpg'
    const timestamp = Date.now()
    const pdfPath   = `${publicationId}/${issueNumber}-${timestamp}.pdf`

    try {
      // 1. Obtener URL firmada de R2 para el PDF y URLs de Supabase para la portada
      setProgressLabel('Obteniendo URLs de subida...')
      const [urlsRes, r2Res] = await Promise.all([
        fetch('/api/admin/get-upload-urls', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: pw },
          body:    JSON.stringify({ publicationId, issueNumber, coverExt }),
        }),
        fetch('/api/admin/r2-upload-url', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: pw },
          body:    JSON.stringify({ path: pdfPath }),
        }),
      ])

      if (!urlsRes.ok) { const e = await urlsRes.json(); throw new Error(e.error || 'Error URLs portada') }
      if (!r2Res.ok)   { const e = await r2Res.json();   throw new Error(e.error || 'Error URL PDF R2') }

      const { cover: coverUpload }           = await urlsRes.json()
      const { signedUrl: r2SignedUrl, fileUrl: pdfFileUrl } = await r2Res.json()
      setProgress(15)

      // 2. Subir portada a Supabase (archivos pequeños, sin limite relevante)
      setProgressLabel('Subiendo portada...')
      const { error: coverErr } = await supabasePublic.storage
        .from('covers')
        .uploadToSignedUrl(coverUpload.path, coverUpload.token, coverFile, {
          contentType: coverFile.type || 'image/jpeg',
          upsert: true,
        })
      if (coverErr) throw new Error('Error subiendo la portada: ' + coverErr.message)
      setProgress(50)

      // 3. Subir PDF directo a Cloudflare R2 — sin limite de tamanio, con progreso real
      setProgressLabel('Subiendo PDF...')
      await uploadToR2(pdfFile, r2SignedUrl, (pct) => {
        setProgress(50 + Math.round(pct * 0.32))
        setProgressLabel(`Subiendo PDF... ${pct}%`)
      })
      setProgress(82)

      // 4. Guardar en la base de datos (la url del PDF es la URL publica de R2)
      setProgressLabel('Guardando edicion...')
      const createRes = await fetch('/api/admin/create-issue', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: pw },
        body:    JSON.stringify({
          publicationId,
          issueNumber: parseInt(issueNumber),
          title,
          coverPath: coverUpload.path,
          pdfUrl:    pdfFileUrl,   // URL publica de R2 (no path de Supabase)
          isPublished,
        }),
      })
      const data = await createRes.json()
      if (!createRes.ok) throw new Error(data.error || 'Error guardando la edicion.')

      setProgress(100)
      setStatus('success')
      setMessage('Edicion publicada correctamente!')
      setResultUrl(data.url || '')
      setPublicationId(''); setIssueNumber(''); setTitle('')
      setCoverFile(null);   setPdfFile(null)
      if (coverInputRef.current) coverInputRef.current.value = ''
      if (pdfInputRef.current)   pdfInputRef.current.value   = ''

    } catch (err) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'Error inesperado. Intenta de nuevo.')
      setProgress(0); setProgressLabel('')
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
        <input ref={pdfInputRef} type="file" accept="application/pdf"
          onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
          className="w-full border border-[#E5E5E5] rounded-lg px-4 py-3 text-[#444] text-sm focus:outline-none focus:border-[#080808] file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-[#F0F0F0] file:text-xs file:cursor-pointer" required />
        <p className="text-[#AAA] text-xs mt-1">PDF — Sin limite de tamanio (Cloudflare R2)</p>
      </div>
      <div>
        <label className={labelCls}>Imagen de portada *</label>
        <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
          className="w-full border border-[#E5E5E5] rounded-lg px-4 py-3 text-[#444] text-sm focus:outline-none focus:border-[#080808] file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-[#F0F0F0] file:text-xs file:cursor-pointer" required />
        <p className="text-[#AAA] text-xs mt-1">JPG o PNG — Recomendado 800x1100px</p>
      </div>
      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} className="w-4 h-4 accent-[#080808]" />
        <span className="text-sm text-[#444]">Publicar inmediatamente</span>
      </label>

      {status === 'uploading' && (
        <div className="space-y-2">
          <div className="h-1.5 bg-[#F0F0F0] rounded-full overflow-hidden">
            <div className="h-full bg-[#080808] transition-all duration-300 rounded-full" style={{ width: progress + '%' }} />
          </div>
          <p className="text-[#888] text-xs">{progressLabel} — {progress}%</p>
        </div>
      )}
      {status === 'success' && (
        <div className="flex items-start gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg p-4">
          <CheckCircle size={16} className="mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm">{message}</p>
            {resultUrl && <a href={resultUrl} className="text-xs underline mt-1 block" target="_blank" rel="noreferrer">Ver edicion →</a>}
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