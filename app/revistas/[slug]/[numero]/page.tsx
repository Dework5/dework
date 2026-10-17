import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { Suspense } from 'react'
import { createServerClient } from '@/lib/supabase-server'
import { PDFReaderWrapper, LoadingFallback } from '@/components/reader/PDFReaderWrapper'

export const revalidate = 60

interface Props {
  params: Promise<{ slug: string; numero: string }>
  searchParams: Promise<{ borrador?: string }>
}

// Borradores: solo en vistas previas de Vercel (nunca en producción). Ahí se ven siempre; en local, con ?borrador=1
// Lee page-images/<publicación>/borradores/<número>.json, que deja el comando `publicar` del estudio.
async function aplicarBorrador(issue: Record<string, unknown>, publicationId: string, numero: string) {
  if (process.env.VERCEL_ENV === 'production') return issue
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/page-images/${publicationId}/borradores/${numero}.json?t=${Date.now()}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return issue
  const b = await res.json()
  return { ...issue, cover_url: b.cover_url, pdf_url: b.pdf_url, page_count: b.page_count, page_images_json: b.page_images_json, images_status: 'ready' }
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

export default async function ReaderPage({ params, searchParams }: Props) {
  const { slug, numero } = await params
  const { borrador } = await searchParams
  const result = await getIssue(slug, numero)

  if (!result) notFound()

  const { publication } = result
  // En las vistas previas de Vercel el borrador se muestra siempre (al iniciar sesión en Vercel se pierde el ?borrador=1)
  const verBorrador = !!borrador || process.env.VERCEL_ENV === 'preview'
  const issue = verBorrador ? await aplicarBorrador(result.issue, publication.id, numero) as typeof result.issue : result.issue

  const seoText = issue.page_texts_json
    ? Object.values(issue.page_texts_json as Record<string, string>).join(' ')
    : null

  return (
    <>
      {seoText ? (
        <p
          aria-hidden="true"
          style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}
        >
          {seoText}
        </p>
      ) : null}
      <Suspense fallback={<LoadingFallback />}>
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
      </Suspense>
    </>
  )
}
