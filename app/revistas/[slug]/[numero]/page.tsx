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

  if (!result) notFound()

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
