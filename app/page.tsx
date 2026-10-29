// ISR: revalidate every 5 min — home page doesn't change often
export const revalidate = 300

import { createServerClient } from '@/lib/supabase-server'
import { HeroSection } from '@/components/home/HeroSection'
import { MarqueeStrip } from '@/components/home/MarqueeStrip'
import { PublicationsSection } from '@/components/home/PublicationsSection'
import { StatsSection } from '@/components/home/StatsSection'
import { ContactSection } from '@/components/home/ContactSection'
import { AnunciantesSection } from '@/components/home/AnunciantesSection'

// Si la base de datos no responde, la portada se arma igual con estos datos (cantidad de ediciones = número de la última)
const pub = (id: string, slug: string, name: string, short: string, description: string, ultima: number) =>
  ({ id, slug, name, short_name: short, shortName: short, description, is_active: true, accent_color: '#A88650', latest_issue: { issue_number: ultima, cover_url: null } })
const FALLBACK_PUBS = [
  pub('1', 'san-diego-la-revista', 'San Diego La Revista', 'SDLR', 'La revista exclusiva del country San Diego. Edición mensual desde 2014.', 144),
  pub('2', 'haras-del-pilar', 'Haras del Pilar', 'HDP', 'La revista del mundo ecuestre y country de Pilar.', 7),
  pub('3', 'pilara-magazine', 'Pilará Magazine', 'PM', 'La publicación de Pilará.', 6),
  pub('4', 'los-lagartos', 'Los Lagartos', 'LL', 'La revista de Los Lagartos Country Club.', 7),
  pub('5', 'campo-chico', 'Campo Chico', 'CC', 'La revista de Campo Chico Country Club.', 2),
  pub('6', 'olivos-golf-club', 'Olivos Golf Club Magazine', 'OGC', 'La revista del Olivos Golf Club.', 1),
]

const FALLBACK_ISSUE = {
  id: '1', issue_number: 144, slug: 'san-diego-la-revista', publication_slug: 'san-diego-la-revista',
  title: 'Edición #144', cover_url: null, pdf_url: null,
  is_published: true, published_at: new Date().toISOString(),
}

async function getData() {
  try {
    const db = createServerClient()
    const { data: publications } = await db
      .from('publications').select('*').eq('is_active', true).order('created_at', { ascending: true })

    // si la base no responde, se usan los datos de respaldo (con la cantidad de ediciones de cada revista)
    const pubs = publications?.length ? publications.map((p: any) => ({ ...FALLBACK_PUBS.find(f => f.slug === p.slug), ...p })) : FALLBACK_PUBS

    // Fetch latest published issue (with cover) for every publication in parallel
    const pubsWithIssues = await Promise.all(
      pubs.map(async (pub: any) => {
        const { data: issue } = await db
          .from('issues')
          .select('id,issue_number,cover_url,title,pdf_url,is_published,published_at,created_at,page_count,page_images_json')
          .eq('publication_id', pub.id)
          .eq('is_published', true)
          .order('published_at', { ascending: false })
          .limit(1)
          .single()
        return { ...pub, latest_issue: issue || pub.latest_issue || null }
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
      <h1 className="sr-only">Dework, agencia digital: revistas de clubes y countries</h1>
      <HeroSection publications={publications} />
      <MarqueeStrip publications={publications} />
      <PublicationsSection publications={publications} />
      {(latestIssue as any)?.page_images_json?.avisos?.length > 0 && (
        <AnunciantesSection
          avisos={(latestIssue as any).page_images_json.avisos}
          slug="san-diego-la-revista"
          numero={latestIssue.issue_number}
          mes={(latestIssue as any).page_images_json.compartir?.mes}
          orden="02"
        />
      )}
      <StatsSection />
      <ContactSection />
    </main>
  )
}
