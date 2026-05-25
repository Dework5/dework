export const dynamic = 'force-dynamic'

import { createServerClient } from '@/lib/supabase-server'
import { HeroSection } from '@/components/home/HeroSection'
import { MarqueeStrip } from '@/components/home/MarqueeStrip'
import { PublicationsSection } from '@/components/home/PublicationsSection'
import { StatsSection } from '@/components/home/StatsSection'
import { ContactSection } from '@/components/home/ContactSection'

const FALLBACK_PUBS = [
  { id: '1', slug: 'san-diego-la-revista', name: 'San Diego La Revista', short_name: 'SDLR', shortName: 'SDLR', description: 'La revista exclusiva del country San Diego. Edición mensual desde 2014.', issueCount: 139, issue_count: 139, is_active: true, accent_color: '#C5A56B', latest_issue: null },
  { id: '2', slug: 'haras-del-pilar',      name: 'Haras del Pilar',       short_name: 'HDP',  shortName: 'HDP',  description: 'El mundo ecuestre y polo.',                       issueCount: 24,  issue_count: 24,  is_active: true, accent_color: '#6B9B8A', latest_issue: null },
  { id: '3', slug: 'pilara-magazine',       name: 'Pilará Magazine',        short_name: 'PM',   shortName: 'PM',   description: 'La publicación de Pilará.',                       issueCount: 18,  issue_count: 18,  is_active: true, accent_color: '#9B6B7A', latest_issue: null },
  { id: '4', slug: 'los-lagartos',          name: 'Los Lagartos',           short_name: 'LL',   shortName: 'LL',   description: 'Polo club Los Lagartos.',                         issueCount: 12,  issue_count: 12,  is_active: true, accent_color: '#6B7B9B', latest_issue: null },
  { id: '5', slug: 'campo-chico',           name: 'Campo Chico',            shortName: 'CC',   short_name: 'CC',  description: 'La vida en el campo.',                            issueCount: 8,   issue_count: 8,   is_active: true, accent_color: '#9B896B', latest_issue: null },
]

const FALLBACK_ISSUE = {
  id: '1', issue_number: 139, slug: 'san-diego-la-revista', publication_slug: 'san-diego-la-revista',
  title: 'Edición #139', cover_url: null, pdf_url: null,
  is_published: true, published_at: new Date().toISOString(),
}

async function getData() {
  try {
    const db = createServerClient()
    const { data: publications } = await db
      .from('publications').select('*').eq('is_active', true).order('created_at', { ascending: true })

    const pubs = publications?.length ? publications : FALLBACK_PUBS

    // Fetch latest published issue (with cover) for every publication in parallel
    const pubsWithIssues = await Promise.all(
      pubs.map(async (pub: any) => {
        const { data: issue } = await db
          .from('issues')
          .select('id,issue_number,cover_url,title,pdf_url,is_published,published_at,created_at,page_count')
          .eq('publication_id', pub.id)
          .eq('is_published', true)
          .order('published_at', { ascending: false })
          .limit(1)
          .single()
        return { ...pub, latest_issue: issue || null }
      })
    )

    const sdlrPub = pubsWithIssues.find((p: any) => p.slug === 'san-diego-la-revista')
    const latestIssue = sdlrPub?.latest_issue
      ? { ...sdlrPub.latest_issue, slug: sdlrPub.slug, publication_slug: sdlrPub.slug }
      : FALLBACK_ISSUE

    return { publications: pubsWithIssues, latestIssue }
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
