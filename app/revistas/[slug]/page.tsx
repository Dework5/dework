import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import Image from 'next/image'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ slug: string }>
}

const PUBLICATIONS_FALLBACK = [
  {
    id: 'fallback-1',
    slug: 'san-diego-la-revista',
    name: 'San Diego La Revista',
    shortName: 'SDLR',
    description: 'La revista de la comunidad de San Diego y zona norte de Buenos Aires. Edición mensual desde 2014.',
    issueCount: 139,
    issue_count: 139,
    category: 'Lifestyle · Comunidad · Zona Norte',
    is_active: true,
  },
  {
    id: 'fallback-2',
    slug: 'haras-del-pilar',
    name: 'Haras del Pilar',
    shortName: 'HDP',
    description: 'La revista del mundo ecuestre y country de Pilar.',
    issueCount: 24,
    issue_count: 24,
    category: 'Lifestyle · Equitación · Country',
    is_active: true,
  },
  {
    id: 'fallback-3',
    slug: 'pilara-magazine',
    name: 'Pilará Magazine',
    shortName: 'PM',
    description: 'Moda, cultura y tendencias de Pilará y alrededores.',
    issueCount: 18,
    issue_count: 18,
    category: 'Moda · Cultura · Tendencias',
    is_active: true,
  },
  {
    id: 'fallback-4',
    slug: 'los-lagartos',
    name: 'Los Lagartos',
    shortName: 'LL',
    description: 'Revista del country Los Lagartos.',
    issueCount: 12,
    issue_count: 12,
    category: 'Country · Comunidad',
    is_active: true,
  },
  {
    id: 'fallback-5',
    slug: 'campo-chico',
    name: 'Campo Chico',
    shortName: 'CC',
    description: 'La vida en el campo chico de zona norte.',
    issueCount: 8,
    issue_count: 8,
    category: 'Campo · Naturaleza',
    is_active: true,
  },
]

async function getPublication(slug: string) {
  let publication = null
  let issues: any[] = []

  try {
    const { data } = await supabase
      .from('publications')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single()
    publication = data
  } catch {
    // silenciar, usar fallback
  }

  if (!publication) {
    publication = PUBLICATIONS_FALLBACK.find(p => p.slug === slug) ?? null
  }

  if (!publication) return null

  try {
    const { data } = await supabase
      .from('issues')
      .select('*')
      .eq('publication_id', publication.id)
      .eq('is_published', true)
      .order('issue_number', { ascending: false })
    issues = data || []
  } catch {
    issues = []
  }

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

  return (
    <main className="min-h-screen bg-dw-black">
      {/* Header */}
      <div className="bg-dw-black pt-32 pb-16 px-6 md:px-10 border-b border-dw-border">
        <div className="max-w-7xl mx-auto">
          <Link href="/" className="text-dw-muted text-[10px] tracking-[0.2em] uppercase hover:text-dw-text transition-colors mb-8 inline-block">
            ← Inicio
          </Link>
          <span className="text-dw-muted text-[10px] tracking-[0.25em] uppercase block mb-4">
            {publication.slug?.toUpperCase()}
          </span>
          <h1 className="font-display font-bold text-dw-white leading-tight mb-4"
            style={{ fontSize: 'clamp(44px, 7vw, 88px)' }}>
            {publication.name}
          </h1>
          <p className="text-dw-muted text-sm max-w-md">
            {publication.description || `${issues?.length || 0} ediciones publicadas`}
          </p>
        </div>
      </div>

      {/* Issues grid */}
      <div className="px-6 md:px-10 py-16">
        <div className="max-w-7xl mx-auto">
          {!issues || issues.length === 0 ? (
            <div className="text-center py-32">
              <p className="font-display italic text-dw-muted text-2xl">Próximamente</p>
              <p className="text-dw-muted text-sm mt-3">
                Las ediciones de {publication.name} estarán disponibles pronto.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-px bg-dw-border">
              {issues.map((issue: any) => (
                <Link
                  key={issue.id}
                  href={`/revistas/${publication.slug}/${issue.issue_number}`}
                  className="bg-dw-card group relative overflow-hidden block"
                >
                  <div className="aspect-[3/4] relative overflow-hidden">
                    {issue.cover_url ? (
                      <Image
                        src={issue.cover_url}
                        alt={issue.title || `Edición #${issue.issue_number}`}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-700"
                      />
                    ) : (
                      <div
                        className="absolute inset-0 bg-dw-surface flex items-end p-4"
                        style={{ backgroundImage: 'repeating-linear-gradient(-45deg, #1a1a1a 0,#1a1a1a 1px,transparent 0,transparent 12px)' }}
                      >
                        <p className="font-display italic text-dw-muted text-sm">#{issue.issue_number}</p>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <span className="text-white text-[11px] tracking-[0.2em] uppercase border border-white/40 px-5 py-3">
                        Leer →
                      </span>
                    </div>
                  </div>
                  <div className="p-4 border-t border-dw-border">
                    <p className="text-dw-muted text-[10px] tracking-widest uppercase">#{issue.issue_number}</p>
                    <p className="text-dw-text text-sm mt-1 font-display">
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
