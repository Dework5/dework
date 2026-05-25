import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase-server'
import { PDFReaderWrapper } from '@/components/reader/PDFReaderWrapper'
import { ArrowLeft, Download } from 'lucide-react'

export const dynamic = 'force-dynamic'

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

export default async function ReaderPage({ params }: Props) {
  const { slug, numero } = await params
  const result = await getIssue(slug, numero)

  if (!result) {
    return (
      <div style={{ background: '#F0EDE8', minHeight: '100vh' }}>
        <div className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center px-5"
          style={{ background: '#111', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <Link href={`/revistas/${slug}`}
            className="flex items-center gap-2 text-[11px] tracking-[0.15em] uppercase transition-colors"
            style={{ color: 'rgba(255,255,255,0.4)' }}>
            <ArrowLeft size={13} />Volver
          </Link>
        </div>
        <div className="flex items-center justify-center" style={{ height: '100vh' }}>
          <div className="text-center px-6">
            <p className="font-display italic text-4xl mb-4" style={{ color: '#C5A56B' }}>Próximamente</p>
            <p className="text-sm mb-8" style={{ color: 'rgba(0,0,0,0.4)' }}>Esta edición estará disponible pronto.</p>
            <Link href={`/revistas/${slug}`}
              className="text-xs tracking-[0.2em] uppercase transition-colors border-b pb-px"
              style={{ color: 'rgba(0,0,0,0.35)', borderColor: 'rgba(0,0,0,0.15)' }}>
              ← Todas las ediciones
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const { issue, publication } = result
  const shortName = publication.short_name || publication.shortName ||
    publication.name.split(' ').map((w: string) => w[0]).join('')
  const title = issue.title || `${shortName} #${issue.issue_number}`

  return (
    <div style={{ background: '#111', overflow: 'hidden' }}>
      <h1 className="sr-only">{title}</h1>

      {/* ── TOP BAR (fixed, 56px) ── */}
      <div className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center px-5 gap-4"
        style={{ background: '#111', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>

        <Link href={`/revistas/${slug}`}
          className="flex items-center gap-1.5 shrink-0 group"
          style={{ color: 'rgba(255,255,255,0.4)' }}
          aria-label="Volver a todas las ediciones">
          <ArrowLeft size={14} className="group-hover:text-white transition-colors" />
          <span className="text-[10px] tracking-[0.2em] uppercase group-hover:text-white transition-colors hidden sm:block">
            Volver
          </span>
        </Link>

        <div className="w-px h-4 shrink-0" style={{ background: 'rgba(255,255,255,0.08)' }} />

        <div className="flex-1 min-w-0 flex items-center gap-2.5">
          <span className="text-[9px] tracking-[0.35em] uppercase shrink-0 font-medium"
            style={{ color: '#C5A56B' }}>
            {shortName}
          </span>
          <span className="text-[11px] truncate" style={{ color: 'rgba(255,255,255,0.55)' }}>
            {title}
          </span>
        </div>

        {issue.pdf_url && (
          <a href={issue.pdf_url} download
            className="flex items-center gap-1.5 shrink-0 group"
            style={{ color: 'rgba(255,255,255,0.35)' }}
            aria-label="Descargar PDF">
            <Download size={14} className="group-hover:text-white transition-colors" />
            <span className="text-[10px] tracking-[0.2em] uppercase group-hover:text-white transition-colors hidden sm:block">
              Descargar
            </span>
          </a>
        )}
      </div>

      {/* ── LECTOR (ocupa exactamente lo que queda debajo del top bar) ── */}
      <div style={{ paddingTop: 56 }}>
        <PDFReaderWrapper
          pdfUrl={issue.pdf_url}
          issueId={issue.id}
          totalPages={issue.page_count}
        />
      </div>
    </div>
  )
}
