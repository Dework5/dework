import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// PDF Reader sin SSR — PDF.js es client-only
const PDFReader = dynamic(() => import('@/components/reader/PDFReader').then(m => ({ default: m.PDFReader })), {
  ssr: false,
})

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
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-sm border-b border-border h-12 flex items-center px-4 gap-4">
        <Link
          href={`/revistas/${slug}`}
          className="flex items-center gap-1 text-text-secondary hover:text-text-primary transition-colors text-sm font-body min-h-[44px]"
        >
          <ChevronLeft size={16} />
          <span className="hidden sm:inline">Volver</span>
        </Link>
        <span className="text-text-muted text-xs font-body truncate">
          {issue.title}
        </span>
      </div>

      {/* Reader — sin Navbar ni Footer del sitio */}
      <div className="pt-12">
        <PDFReader
          pdfUrl={issue.pdf_url}
          issueId={issue.id}
          totalPages={issue.page_count}
        />
      </div>
    </>
  )
}
