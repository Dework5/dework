import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
import { PDFReaderWrapper } from '@/components/reader/PDFReaderWrapper'
import { ArrowLeft, Download } from 'lucide-react'

interface Props {
  params: Promise<{ slug: string; numero: string }>
}

async function getIssue(slug: string, numero: string) {
  const { data: publication } = await supabase
    .from('publications')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!publication) return null

  const { data: issue } = await supabase
    .from('issues')
    .select('*')
    .eq('publication_id', publication.id)
    .eq('issue_number', parseInt(numero))
    .eq('is_published', true)
    .single()

  if (!issue) return null

  return { issue, publication }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, numero } = await params
  const result = await getIssue(slug, numero)
  if (!result) return {}

  const { issue, publication } = result
  return {
    title: `${issue.title || publication.name + ' #' + issue.issue_number} — Dework`,
    description: `Leé online la edición #${issue.issue_number} de ${publication.name}. Acceso gratuito, sin registro.`,
    robots: { index: true, follow: true },
    openGraph: issue.cover_url
      ? { images: [{ url: issue.cover_url, width: 800, height: 1100 }] }
      : undefined,
  }
}

export default async function ReaderPage({ params }: Props) {
  const { slug, numero } = await params
  const result = await getIssue(slug, numero)

  if (!result) {
    return (
      <>
        <div className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/98 backdrop-blur border-b border-white/8 h-14 flex items-center px-5 gap-4">
          <Link href={`/revistas/${slug}`}
            className="flex items-center gap-2 text-white/40 hover:text-white transition-colors text-[11px] tracking-[0.15em] uppercase">
            <ArrowLeft size={14} />
            Volver
          </Link>
        </div>
        <div className="bg-[#0d0d0d] min-h-screen pt-14 flex items-center justify-center">
          <div className="text-center px-6">
            <p className="font-display italic text-[#C5A56B] text-4xl mb-4">Próximamente</p>
            <p className="text-white/40 text-sm mb-8">Esta edición estará disponible pronto.</p>
            <Link href={`/revistas/${slug}`}
              className="text-white/40 text-xs tracking-[0.2em] uppercase hover:text-white transition-colors border-b border-white/10 pb-px">
              ← Todas las ediciones
            </Link>
          </div>
        </div>
      </>
    )
  }

  const { issue, publication } = result
  const title = issue.title || `${publication.shortName || publication.name} #${issue.issue_number}`

  return (
    <>
      <h1 className="sr-only">{title}</h1>

      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/98 backdrop-blur-md border-b border-white/8 h-14 flex items-center px-5 gap-4">
        {/* Volver */}
        <Link
          href={`/revistas/${slug}`}
          className="flex items-center gap-1.5 text-white/40 hover:text-white transition-colors shrink-0"
          aria-label="Volver a todas las ediciones"
        >
          <ArrowLeft size={15} />
          <span className="text-[11px] tracking-[0.15em] uppercase hidden sm:block">Volver</span>
        </Link>

        <div className="w-px h-4 bg-white/10 shrink-0" />

        {/* Título */}
        <div className="flex-1 min-w-0 flex items-center gap-3">
          <span className="text-white/20 text-[9px] tracking-[0.3em] uppercase shrink-0">
            {publication.shortName || publication.name.split(' ').map((w: string) => w[0]).join('')}
          </span>
          <span className="text-white/70 text-[12px] tracking-[0.05em] truncate">
            {title}
          </span>
        </div>

        {/* Descargar */}
        {issue.pdf_url && (
          <a
            href={issue.pdf_url}
            download
            className="flex items-center gap-1.5 text-white/40 hover:text-white transition-colors shrink-0"
            aria-label="Descargar PDF"
          >
            <Download size={14} />
            <span className="text-[11px] tracking-[0.15em] uppercase hidden sm:block">Descargar</span>
          </a>
        )}
      </div>

      {/* Reader */}
      <div className="bg-[#0d0d0d] pt-14 min-h-screen">
        <PDFReaderWrapper
          pdfUrl={issue.pdf_url}
          issueId={issue.id}
          totalPages={issue.page_count}
        />
      </div>
    </>
  )
}