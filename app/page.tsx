// ISR: revalidate every 5 min — home page doesn't change often
export const revalidate = 300

import { PUBLICACIONES } from '@/lib/estatico'
import { HeroSection } from '@/components/home/HeroSection'
import { MarqueeStrip } from '@/components/home/MarqueeStrip'
import { PublicationsSection } from '@/components/home/PublicationsSection'
import { StatsSection } from '@/components/home/StatsSection'
import { ContactSection } from '@/components/home/ContactSection'
import { AnunciantesSection } from '@/components/home/AnunciantesSection'

async function getData() {
  const publications = PUBLICACIONES
  const sd = publications[0]
  return { publications, latestIssue: { ...sd.latest_issue, slug: sd.slug, publication_slug: sd.slug } }
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
