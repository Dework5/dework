'use client'

import dynamic from 'next/dynamic'
import type { PreRenderedImages } from '@/lib/types'

const PDFReader = dynamic(() => import('./PDFReader'), {
  ssr: false,
  loading: () => (
    <div
      className="flex flex-col items-center justify-center gap-5"
      style={{
        height: '100vh',
        backgroundColor: '#F5F3F0',
      }}
    >
      <div
        className="animate-pulse"
        style={{
          width: 260,
          height: 368,
          background: 'linear-gradient(135deg, #E8E4DF 25%, #EBE8E3 50%, #E8E4DF 75%)',
          boxShadow: '0 0 0 3px #c8961e, 0 8px 32px rgba(0,0,0,0.18)',
        }}
      />
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-[#C5A56B] animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-1.5 h-1.5 rounded-full bg-[#C5A56B] animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-1.5 h-1.5 rounded-full bg-[#C5A56B] animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <p className="text-[11px] tracking-[0.3em] uppercase" style={{ color: 'rgba(0,0,0,0.35)' }}>
        Preparando revista…
      </p>
    </div>
  ),
})

interface Props {
  coverUrl?:        string
  pdfUrl:           string
  issueId:          string
  totalPages?:      number
  backUrl:          string
  downloadUrl?:     string
  publicationName?: string
  issueTitle?:      string
  preRendered?:     PreRenderedImages | null
  imagesStatus?:    'pending' | 'processing' | 'ready' | 'partial_error'
}

export function PDFReaderWrapper({ pdfUrl, issueId, totalPages, coverUrl, backUrl, downloadUrl, publicationName, issueTitle, preRendered, imagesStatus }: Props) {
  return (
    <PDFReader
      pdfUrl={pdfUrl}
      issueId={issueId}
      totalPages={totalPages}
      coverUrl={coverUrl}
      backUrl={backUrl}
      downloadUrl={downloadUrl}
      publicationName={publicationName}
      issueTitle={issueTitle}
      preRendered={preRendered}
      imagesStatus={imagesStatus}
    />
  )
}
