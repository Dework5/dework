import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { createServerClient } from '@/lib/supabase-server'
import Link from 'next/link'
import { CoverImage } from '@/components/issues/CoverImage'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ slug: string }>
}

const PUBLICATIONS_FALLBACK = [
  {
    id: 'fallback-1',
    slug: 'san-diego-la-revista',
    name: 'San Diego La Revista',
    short_name: 'SDLR',
    shortName: 'SDLR',
    description: 'La revista exclusiva del country San Diego. Edición mensual desde 2014.',
    is_active: true,
  },
  {
    id: 'fallback-2',
    slug: 'haras-del-pilar',
    name: 'Haras del Pilar',
    short_name: 'HDP',
    shortName: 'HDP',
    description: 'La revista del mundo ecuestre y country de Pilar.',
    is_active: true,
  },
  {
    id: 'fallback-3',
    slug: 'pilara-magazine',
    name: 'Pilará Magazine',
    short_name: 'PM',
    shortName: 'PM',
    description: 'Moda, cultura y tendencias de Pilará y alrededores.',
    is_active: true,
  },
  {
    id: 'fallback-4',
    slug: 'los-lagartos',
    name: 'Los Lagartos',
    short_name: 'LL',
    shortName: 'LL',
    description: 'Revista del country Los Lagartos.',
    is_active: true,
  },
  {
    id: 'fallback-5',
    slug: 'campo-chico',
    name: 'Campo Chico',
    short_name: 'CC',
    shortName: 'CC',
    description: 'La vida en el campo chico de zona norte.',
    is_active: true,
  },
]

async function getPublication(slug: string) {
  const db = createServerClient()
  let publication = null
  let issues: any[] = []

  const { data: pubData } = await db
    .from('publications')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()
  publication = pubData

  if (!publication) {
    publication = PUBLICATIONS_FALLBACK.find(p => p.slug === slug) ?? null
  }

  if (!publication) return null

  const { data: issuesData } = await db
    .from('issues')
    .select('*')
    .eq('publication_id', publication.id)
    .eq('is_published', true)
    .order('issue_number', { ascending: false })
  issues = issuesData || []

  return { publication, issues }
}

export async function generateStaticParams() {
  return PUBLICATIONS_FALLBACK.map(p => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const result = await getPublication(slug)
  if (!result) return {}

  const { publication } = result
  return {
    title: `${publication.name} — Todas las ediciones`,
    description: `Leé online todas las ediciones de ${publication.name}. Acceso gratuito, sin registro. ${publication.description || ''}`,
    alternates: {
      canonical: `https://dework.com.ar/revistas/${slug}`,
    },
  }
}

export default async function RevistasSlugPage({ params }: Props) {
  const { slug } = await params
  const result = await getPublication(slug)

  if (!result) notFound()

  const { publication, issues } = result
  const shortName = publication.short_name || publication.shortName || publication.name?.slice(0, 4).toUpperCase()

  return (
    <main className="min-h-screen bg-dw-black">

      {/* ── HEADER ── */}
      <div className="relative pt-28 pb-14 px-6 md:px-12 overflow-hidden">

        {/* Número decorativo de fondo */}
        {issues.length > 0 && (
          <span
            aria-hidden
            className="pointer-events-none select-none absolute right-8 top-1/2 -translate-y-1/2 font-display font-bold leading-none text-dw-surface hidden lg:block"
            style={{ fontSize: 'clamp(140px, 18vw, 260px)' }}
          >
            {issues.length}
          </span>
        )}

        <div className="max-w-6xl mx-auto relative z-10">
          {/* Breadcrumb */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-dw-muted text-[10px] tracking-[0.25em] uppercase hover:text-dw-text transition-colors mb-10"
          >
            <span>←</span>
            <span>Inicio</span>
          </Link>

          {/* Badge */}
          <div className="mb-5">
            <span className="inline-block text-dw-sub text-[10px] tracking-[0.35em] uppercase border border-dw-border px-3 py-1.5">
              {shortName}
            </span>
          </div>

          {/* Título */}
          <h1
            className="font-display font-bold text-dw-white leading-none mb-5"
            style={{ fontSize: 'clamp(42px, 6.5vw, 86px)' }}
          >
            {publication.name}
          </h1>

          {/* Descripción + conteo */}
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-10">
            <p className="text-dw-sub text-sm max-w-sm leading-relaxed">
              {publication.description}
            </p>
            {issues.length > 0 && (
              <p className="text-dw-muted text-xs tracking-[0.2em] uppercase shrink-0">
                {issues.length} {issues.length === 1 ? 'edición' : 'ediciones'}
              </p>
            )}
          </div>
        </div>

        {/* Línea separadora */}
        <div className="max-w-6xl mx-auto mt-12">
          <div className="h-px bg-gradient-to-r from-dw-border via-dw-hover to-transparent" />
        </div>
      </div>

      {/* ── GRID ── */}
      <div className="px-6 md:px-12 pb-24">
        <div className="max-w-6xl mx-auto">
          {!issues || issues.length === 0 ? (
            <div className="text-center py-32">
              <p className="font-display italic text-dw-muted text-2xl mb-3">Próximamente</p>
              <p className="text-dw-sub text-sm">
                Las ediciones de {publication.name} estarán disponibles pronto.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5 md:gap-7">
              {issues.map((issue: any) => (
                <Link
                  key={issue.id}
                  href={`/revistas/${publication.slug}/${issue.issue_number}`}
                  className="group"
                >
                  {/* Portada */}
                  <div className="aspect-[3/4] relative overflow-hidden bg-dw-card shadow-[0_2px_20px_rgba(0,0,0,0.5)]">
                    <CoverImage
                      src={issue.cover_url}
                      alt={issue.title || `Edición #${issue.issue_number}`}
                      issueNumber={issue.issue_number}
                      shortName={shortName}
                    />

                    {/* Overlay al hover */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <span className="text-white text-[10px] tracking-[0.28em] uppercase border border-white/25 px-4 py-2.5 translate-y-1.5 group-hover:translate-y-0 transition-transform duration-300 ease-out">
                        Leer →
                      </span>
                    </div>

                    {/* Badge número — esquina superior izquierda */}
                    <div className="absolute top-2.5 left-2.5 bg-black/60 backdrop-blur-sm px-2 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <span className="text-white/70 text-[9px] tracking-widest">#{issue.issue_number}</span>
                    </div>
                  </div>

                  {/* Metadata debajo de la portada */}
                  <div className="mt-3 space-y-0.5">
                    <p className="text-dw-muted text-[9px] tracking-[0.25em] uppercase">
                      #{issue.issue_number}
                    </p>
                    <p className="text-dw-sub text-[11px] font-display leading-snug line-clamp-2 group-hover:text-dw-text transition-colors duration-200">
                      {issue.title || `Edición ${issue.issue_number}`}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

    </main>
  )
}
