'use client'

import dynamic from 'next/dynamic'

const PDFReader = dynamic(() => import('./PDFReader'), {
  ssr: false,
  loading: () => (
    <div
      className="flex flex-col items-center justify-center gap-5 min-h-screen"
      style={{ background: '#F0EDE8' }}
    >
      <div
        className="animate-pulse rounded-sm"
        style={{
          width: 280,
          height: 396,
          background: 'linear-gradient(135deg, #E8E4DF 25%, #EBE8E3 50%, #E8E4DF 75%)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        }}
      />
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-[#C5A56B] animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-1.5 h-1.5 rounded-full bg-[#C5A56B] animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-1.5 h-1.5 rounded-full bg-[#C5A56B] animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <p className="text-gray-400 text-[11px] tracking-[0.3em] uppercase">
        Preparando revista…
      </p>
    </div>
  ),
})

interface Props {
  coverUrl?: string
  pdfUrl: string
  issueId: string
  totalPages?: number
}

export function PDFReaderWrapper({ pdfUrl, issueId, totalPages, coverUrl }: Props) {
  return <PDFReader pdfUrl={pdfUrl} issueId={issueId} totalPages={totalPages} coverUrl={coverUrl} />
}
