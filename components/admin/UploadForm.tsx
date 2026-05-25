'use client'

import { useState, useRef } from 'react'
import { Upload, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react'
import { Publication } from '@/lib/types'
import { supabase as supabasePublic } from '@/lib/supabase'

interface UploadFormProps {
  publications: Publication[]
}

const inputCls = 'w-full border border-[#E5E5E5] rounded-lg px-4 py-3 text-[#080808] text-sm focus:outline-none focus:border-[#080808] transition-colors bg-white'
const labelCls = 'block text-[#333] text-xs font-semibold uppercase tracking-wider mb-2'

const MB = 1024 * 1024
const MAX_PDF_MB = 45

export function UploadForm({ publications }: UploadFormProps) {
  const [publicationId, setPublicationId] = useState('')
  const [issueNumber,   setIssueNumber]   = useState('')
  const [title,         setTitle]         = useState('')
  const [coverFile,     setCoverFile]     = useState<File | null>(null)
  const [pdfFile,       setPdfFile]       = useState<File | null>(null)
  const [pdfSizeMB,     setPdfSizeMB]     = useState<number>(0)
  const [isPublished,   setIsPublished]   = useState(true)
  const [progress,      setProgress]      = useState(0)
  const [progressLabel, setProgressLabel] = useState('')
  const [status,        setStatus]        = useState<'idle'|'uploading'|'success'|'error'>('idle')
  const [message,       setMessage]       = useState('')
  const [resultUrl,     setResultUrl]     = useState('')

  const coverInputRef = useRef<HTMLInputElement>(null)
  const pdfInputRef   = useRef<HTMLInputElement>(null)

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    setPdfFile(file)
    setPdfSizeMB(file ? Math.round(file.size / MB * 10) / 10 : 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!publicationId || !issueNumber || !title || !coverFile || !pdfFile) {
      setMessage('Completa todos los campos.')
      setStatus('error')
      return
    }

    // Chequeo de tamanio antes de empezar
    if (pdfFile.size > MAX_PDF_MB * MB) {
      setStatus('error')
      setMessage(`PDF_TOO_LARGE:${pdfSizeMB}`)
      return
    }

    setStatus('uploading')
    setProgress(5)
    setProgressLabel('Preparando subida...')

    const pw = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || ''
    const coverExt = coverFile.name.split('.').pop() || 'jpg'

    try {
      // 1. Obtener URLs firmadas (portada y PDF en Supabase Storage)
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

      // 2. Subir portada a Supabase
      setProgressLabel('Subiendo portada...')
      const { error: coverErr } = await supabasePublic.storage
        .from('covers')
        .uploadToSignedUrl(coverUpload.path, coverUpload.token, coverFile, {
          contentType: coverFile.type || 'image/jpeg',
          upsert: true,
        })
      if (coverErr) throw new Error('Error subiendo la portada: ' + coverErr.message)
      setProgress(50)

      // 3. Subir PDF a Supabase (< 45 MB garantizado por el chequeo previo)
      setProgressLabel('Subiendo PDF...')
      const { error: pdfErr } = await supabasePublic.storage
        .from('pdfs')
        .uploadToSignedUrl(pdfUpload.path, pdfUpload.token, pdfFile, {
          contentType: 'application/pdf',
          upsert: true,
        })
      if (pdfErr) throw new Error('Error subiendo el PDF: ' + pdfErr.message)
      setProgress(82)

      // 4. Guardar en la base de datos
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
      setPublicationId(''); setIssueNumber(''); setTitle('')
      setCoverFile(null);   setPdfFile(null);   setPdfSizeMB(0)
      if (coverInputRef.current) coverInputRef.current.value = ''
      if (pdfInputRef.current)   pdfInputRef.current.value   = ''

    } catch (err) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'Error inesperado. Intenta de nuevo.')
      setProgress(0); setProgressLabel('')
    }
  }

  // Error especial cuando el PDF es muy grande
  const isTooLarge = status === 'error' && message.startsWith('PDF_TOO_LARGE:')
  const tooLargeMB = isTooLarge ? message.split(':')[1] : ''

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
          onChange={handlePdfChange}
          className="w-full border border-[#E5E5E5] rounded-lg px-4 py-3 text-[#444] text-sm focus:outline-none focus:border-[#080808] file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-[#F0F0F0] file:text-xs file:cursor-pointer" required />
        {pdfFile && (
          <p className={`text-xs mt-1 ${pdfFile.size > MAX_PDF_MB * MB ? 'text-red-500 font-medium' : 'text-[#AAA]'}`}>
            {pdfSizeMB} MB {pdfFile.size > MAX_PDF_MB * MB ? `— demasiado grande (máximo ${MAX_PDF_MB} MB)` : '— OK'}
          </p>
        )}
        {!pdfFile && <p className="text-[#AAA] text-xs mt-1">PDF — máximo {MAX_PDF_MB} MB</p>}
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

      {isTooLarge && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
          <div className="flex items-start gap-2 text-amber-700">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <p className="text-sm font-medium">PDF demasiado grande: {tooLargeMB} MB (máximo {MAX_PDF_MB} MB)</p>
          </div>
          <p className="text-amber-600 text-xs pl-6">
            Comprimilo gratis antes de subir — tarda menos de 1 minuto:
          </p>
          <div className="flex gap-3 pl-6">
            <a href="https://smallpdf.com/compress-pdf" target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-xs text-amber-700 underline hover:text-amber-900">
              smallpdf.com <ExternalLink size={10} />
            </a>
            <a href="https://www.ilovepdf.com/compress_pdf" target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-xs text-amber-700 underline hover:text-amber-900">
              ilovepdf.com <ExternalLink size={10} />
            </a>
          </div>
        </div>
      )}

      {status === 'error' && !isTooLarge && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg p-4">
          <AlertCircle size={16} className="flex-shrink-0" />
          <p className="text-sm">{message}</p>
        </div>
      )}

      <button type="submit" disabled={status === 'uploading' || (pdfFile !== null && pdfFile.size > MAX_PDF_MB * MB)}
        className="flex items-center gap-2 bg-[#080808] text-white py-3 px-8 rounded-lg text-sm font-medium hover:bg-[#333] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
        <Upload size={16} />
        {status === 'uploading' ? progressLabel : 'Publicar edicion'}
      </button>
    </form>
  )
}