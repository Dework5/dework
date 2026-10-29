import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { Suspense } from 'react'
import { publicacion, edicion } from '@/lib/estatico'
import { PDFReaderWrapper, LoadingFallback } from '@/components/reader/PDFReaderWrapper'
import type { PreRenderedImages } from '@/lib/types'

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
  const publication = publicacion(slug)
  const issue = edicion(slug, parseInt(numero))
  if (!publication || !issue) return null
  return { issue, publication }
}

// Lo que muestra WhatsApp (y otras redes) al pegar el link: tarjeta con la tapa y las notas.
// Con ?nota=<id> la tarjeta es la de esa nota (título, bajada y foto).
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug, numero } = await params
  const { nota: notaId } = (await searchParams) as { nota?: string }
  const result = await getIssue(slug, numero)
  if (!result) return {}
  const { issue, publication } = result
  const pij = issue.page_images_json as PreRenderedImages | null
  const compartir = pij?.compartir
  const nota = notaId ? pij?.notas?.find(n => n.id === notaId) : undefined
  const url = `https://www.dework.com.ar/revistas/${slug}/${numero}${nota ? `?nota=${nota.id}` : ''}`

  const titulo = nota
    ? `${nota.titulo}${nota.tituloCursiva ? ' ' + nota.tituloCursiva : ''} · ${publication.name}`
    : compartir?.titulo ?? `${issue.title || publication.name + ' #' + issue.issue_number}`
  const descripcion = nota?.bajada
    ?? (compartir ? `En esta edición: ${compartir.notas.join(' · ')}. Leela gratis, sin registro.` : `Leé online la edición #${issue.issue_number} de ${publication.name}. Acceso gratuito, sin registro.`)
  const imagen = nota?.foto && !nota.foto.endsWith('.webp')
    ? { url: nota.foto, width: 1200, height: 800 }
    : compartir ? { url: compartir.og, width: 1200, height: 630 } : issue.cover_url ? { url: issue.cover_url, width: 800, height: 1100 } : undefined

  return {
    title: `${titulo} — Dework`,
    description: descripcion,
    robots: { index: true, follow: true },
    openGraph: { title: titulo, description: descripcion, url, siteName: 'Dework Editorial', locale: 'es_AR', type: 'article', images: imagen ? [imagen] : undefined },
    twitter: { card: 'summary_large_image', title: titulo, description: descripcion, images: imagen ? [imagen.url] : undefined },
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
