export const dynamic = 'force-dynamic'

import { createServerClient } from '@/lib/supabase-server'
import { HeroSection } from '@/components/home/HeroSection'
import { MarqueeStrip } from '@/components/home/MarqueeStrip'
import { PublicationsSection } from '@/components/home/PublicationsSection'
import { StatsSection } from '@/components/home/StatsSection'
import { ContactSection } from '@/components/home/ContactSection'

const FALLBACK_PUBS = [
  { id: '1', slug: 'san-diego-la-revista', name: 'San Diego La Revista', shortName: 'SDLR', description: 'La revista de zona norte. Más de 139 ediciones.', issueCount: 139, is_active: true },
  { id: '2', slug: 'haras-del-pilar',      name: 'Haras del Pilar',       shortName: 'HDP',  description: 'El mundo ecuestre y polo.',                       issueCount: 24,  is_active: true },
  { id: '3', slug: 'pilara-magazine',       name: 'Pilará Magazine',        shortName: 'PM',   description: 'La publicación de Pilará.',                       issueCount: 18,  is_active: true },
  { id: '4', slug: 'los-lagartos',          name: 'Los Lagartos',           shortName: 'LL',   description: 'Polo club Los Lagartos.',                         issueCount: 12,  is_active: true },
  { id: '5', slug: 'campo-chico',           name: 'Campo Chico',            shortName: 'CC',   description: 'La vida en el campo.',                            issueCount: 8,   is_active: true },
]

const FALLBACK_ISSUE = {
  id: '1', issue_number: 139, slug: 'san-diego-la-revista',
  title: 'Edición #139', cover_url: null, pdf_url: null,
  is_published: true, published_at: new Date().toISOString(),
}

async function getData() {
  try {
    const db = createServerClient()
    const { data: publications } = await db
      .from('publications').select('*').eq('is_active', true).order('created_at', { ascending: true })
    const sdlrPub = publications?.find((p: any) => p.slug === 'san-diego-la-revista')
    let latestIssue = null
    if (sdlrPub) {
      const { data: issue } = await db
        .from('issues').select('*').eq('publication_id', sdlrPub.id)
        .eq('is_published', true).order('published_at', { ascending: false }).limit(1).single()
      latestIssue = issue
    }
    return {
      publications: publications?.length ? publications : FALLBACK_PUBS,
      latestIssue: latestIssue || FALLBACK_ISSUE,
    }
  } catch {
    return { publications: FALLBACK_PUBS, latestIssue: FALLBACK_ISSUE }
  }
}

export default async function HomePage() {
  const { publications, latestIssue } = await getData()
  return (
    <main>
      <h1 className="sr-only">Revistas editoriales de San Diego y zona norte</h1>
      <HeroSection issue={latestIssue} />
      <MarqueeStrip publications={publications} />
      <PublicationsSection publications={publications} />
      <StatsSection />
      <ContactSection />
    </main>
  )
}
