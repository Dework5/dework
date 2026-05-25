'use client'

import dynamic from 'next/dynamic'

// En Next.js 16, dynamic con ssr: false solo puede estar en Client Components
const PDFReader = dynamic(() => import('./PDFReader'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center gap-4 pt-24 min-h-screen bg-black justify-center">
      <div className="w-48 h-64 md:w-64 md:h-80 bg-surface-elevated animate-pulse rounded-sm" />
      <p className="text-text-muted font-body text-sm animate-pulse">
        Cargando revista...
      </p>
    </div>
  ),
})

interface Props {
  pdfUrl: string
  issueId: string
  totalPages?: number
}

export function PDFReaderWrapper({ pdfUrl, issueId, totalPages }: Props) {
  return <PDFReader pdfUrl={pdfUrl} issueId={issueId} totalPages={totalPages} />
}
