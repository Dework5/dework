import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { PDFReaderWrapper } from '@/components/reader/PDFReaderWrapper'

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
    title: `${publication.name} #${issue.issue_number}`,
    description: `Leé online la edición #${issue.issue_number} de ${publication.name}. Acceso gratuito.`,
    robots: { index: true, follow: true },
  }
}

export default async function ReaderPage({ params }: Props) {
  const { slug, numero } = await params
  const result = await getIssue(slug, numero)

  // Show "próximamente" instead of 404 when issue doesn't exist yet
  if (!result) {
    return (
      <>
        <div className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur border-b border-dw-border h-14 flex items-center px-6 gap-6">
          <Link href={`/revistas/${slug}`}
            className="text-dw-muted text-[11px] tracking-[0.15em] uppercase hover:text-dw-text transition-colors">
            ← Volver
          </Link>
          <span className="text-dw-border">|</span>
          <span className="text-dw-muted text-[11px] tracking-[0.1em] uppercase">Edición #{numero}</span>
        </div>
        <div className="bg-dw-black min-h-screen pt-14 flex items-center justify-center">
          <div className="text-center px-6">
            <p className="font-display italic text-dw-sub text-4xl mb-4">Próximamente</p>
            <p className="text-dw-muted text-sm mb-8">Esta edición estará disponible pronto.</p>
            <Link href={`/revistas/${slug}`}
              className="text-dw-sub text-xs tracking-[0.2em] uppercase hover:text-dw-white transition-colors border-b border-dw-border pb-px">
              ← Volver a todas las ediciones
            </Link>
          </div>
        </div>
      </>
    )
  }

  const { issue, publication } = result

  return (
    <>
      <h1 className="sr-only">{issue.title}</h1>

      {/* Barra superior del lector */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur border-b border-dw-border h-14 flex items-center px-6 gap-6">
        <Link href={`/revistas/${slug}`}
          className="text-dw-muted text-[11px] tracking-[0.15em] uppercase hover:text-dw-text transition-colors">
          ← Volver
        </Link>
        <span className="text-dw-border">|</span>
        <span className="text-dw-muted text-[11px] tracking-[0.1em] uppercase flex-1 truncate">{issue?.title || `Edición #${numero}`}</span>
        {issue?.pdf_url && (
          <a href={issue.pdf_url} download
            className="text-dw-muted text-[11px] tracking-[0.15em] uppercase hover:text-dw-text transition-colors">
            Descargar ↓
          </a>
        )}
      </div>

      {/* Reader */}
      <div className="bg-black pt-14 min-h-screen">
        <PDFReaderWrapper
          pdfUrl={issue.pdf_url}
          issueId={issue.id}
          totalPages={issue.page_count}
        />
      </div>
    </>
  )
}
