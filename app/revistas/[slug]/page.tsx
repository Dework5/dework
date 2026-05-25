import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { supabase } from '@/lib/supabase'
import { IssuesGrid } from '@/components/issues/IssuesGrid'
import { AnimateOnScroll } from '@/components/ui/AnimateOnScroll'
import Link from 'next/link'

interface Props {
  params: Promise<{ slug: string }>
}

async function getPublication(slug: string) {
  const { data: publication } = await supabase
    .from('publications')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!publication) return null

  const { data: issues } = await supabase
    .from('issues')
    .select('*')
    .eq('publication_id', publication.id)
    .eq('is_published', true)
    .order('issue_number', { ascending: false })

  return { publication, issues: issues || [] }
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

  const periodicalSchema = {
    '@context': 'https://schema.org',
    '@type': 'Periodical',
    name: publication.name,
    description: publication.description,
    publisher: { '@type': 'Organization', name: 'Dework Editorial' },
    url: `https://dework.com.ar/revistas/${slug}`,
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(periodicalSchema) }}
      />
      <h1 className="sr-only">{publication.name}</h1>

      {/* Header publicación */}
      <section
        className="pt-24 pb-16 md:pt-32 md:pb-24"
        style={{
          background: `linear-gradient(to bottom, ${publication.accent_color}15, #0A0A0A)`,
        }}
      >
        <div className="max-w-content mx-auto px-4 md:px-8 text-center">
          <AnimateOnScroll>
            <span
              className="inline-block px-3 py-1 text-xs font-body tracking-widest uppercase font-medium rounded-sm mb-6 text-white"
              style={{ backgroundColor: publication.accent_color }}
            >
              {publication.short_name}
            </span>
            <h2 className="text-4xl md:text-5xl font-display font-bold text-text-primary mb-4">
              {publication.name}
            </h2>
            {publication.description && (
              <p className="text-text-secondary font-body text-lg max-w-2xl mx-auto leading-relaxed">
                {publication.description}
              </p>
            )}
            <p className="mt-6 text-text-muted font-body text-sm">
              {issues.length} ediciones publicadas
            </p>
          </AnimateOnScroll>
        </div>
      </section>

      {/* Grid de ediciones */}
      <section className="bg-background py-12 md:py-16">
        <div className="max-w-content mx-auto px-4 md:px-8">
          <IssuesGrid issues={issues} slug={slug} />
        </div>
      </section>

      {/* CTA Anunciantes */}
      <section className="bg-surface border-t border-border py-12">
        <div className="max-w-content mx-auto px-4 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-text-secondary font-body text-sm">
            ¿Querés pautar en <span className="text-text-primary">{publication.name}</span>?
          </p>
          <Link
            href="/anunciantes"
            className="border border-border text-text-primary py-2 px-6 rounded-sm font-body text-sm font-medium hover:border-text-secondary transition-colors whitespace-nowrap min-h-[44px] flex items-center"
          >
            Hablar con nosotros
          </Link>
        </div>
      </section>
    </>
  )
}
