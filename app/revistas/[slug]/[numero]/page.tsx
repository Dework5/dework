import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { createServerClient } from '@/lib/supabase-server'
import { PDFReaderWrapper } from '@/components/reader/PDFReaderWrapper'

// ISR: cache reader pages for 60 s
export const revalidate = 60

interface Props {
  params: Promise<{ slug: string; numero: string }>
}

async function getIssue(slug: string, numero: string) {
  const db = createServerClient()

  const { data: publication } = await db
    .from('publications')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!publication) return null

  const { data: issue } = await db
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

function proxyPdf(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  return url
}

export default async function ReaderPage({ params }: Props) {
  const { slug, numero } = await params
  const result = await getIssue(slug, numero)

  if (!result) notFound()

  const { issue, publication } = result

  return (
    <PDFReaderWrapper
      pdfUrl={proxyPdf(issue.pdf_url) ?? ''}
      issueId={issue.id}
      totalPages={issue.page_count}
      coverUrl={issue.cover_url || undefined}
      backUrl={`/revistas/${slug}`}
      downloadUrl={issue.pdf_url || undefined}
      publicationName={publication.name}
      issueTitle={`#${issue.issue_number}`}
      preRendered={issue.page_images_json ?? null}
      imagesStatus={issue.images_status ?? 'pending'}
    />
  )
}
