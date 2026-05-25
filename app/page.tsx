export const dynamic = 'force-dynamic'

import { supabase } from '@/lib/supabase'
import { HeroLatestIssue } from '@/components/home/HeroLatestIssue'
import { PublicationsGrid } from '@/components/home/PublicationsGrid'
import { AdvertiserBanner } from '@/components/home/AdvertiserBanner'
import { ContactSection } from '@/components/home/ContactSection'
import { PublicationWithLatestIssue } from '@/lib/types'

async function getData() {
  // Obtener todas las publicaciones activas
  const { data: publications } = await supabase
    .from('publications')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  // Obtener última edición de SDLR
  const sdlrPub = publications?.find((p) => p.slug === 'san-diego-la-revista')
  let latestIssue = null

  if (sdlrPub) {
    const { data: issue } = await supabase
      .from('issues')
      .select('*')
      .eq('publication_id', sdlrPub.id)
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(1)
      .single()
    latestIssue = issue
  }

  // Para cada publicación, obtener su última edición
  const publicationsWithIssues: PublicationWithLatestIssue[] = await Promise.all(
    (publications || []).map(async (pub) => {
      const { data: issue } = await supabase
        .from('issues')
        .select('*')
        .eq('publication_id', pub.id)
        .eq('is_published', true)
        .order('published_at', { ascending: false })
        .limit(1)
        .single()
      return { ...pub, latest_issue: issue || null }
    })
  )

  return { publications: publicationsWithIssues, latestIssue, sdlrPub }
}

export default async function HomePage() {
  const { publications, latestIssue, sdlrPub } = await getData()

  return (
    <>
      {/* SEO H1 oculto */}
      <h1 className="sr-only">Revistas editoriales de San Diego y zona norte</h1>

      <HeroLatestIssue issue={latestIssue} publication={sdlrPub || null} />
      <PublicationsGrid publications={publications} />
      <AdvertiserBanner />
      <ContactSection />
    </>
  )
}
