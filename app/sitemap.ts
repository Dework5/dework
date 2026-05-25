import { MetadataRoute } from 'next'
import { supabase } from '@/lib/supabase'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = 'https://dework.com.ar'

  // Obtener publicaciones
  const { data: publications } = await supabase
    .from('publications')
    .select('slug, created_at')
    .eq('is_active', true)

  // Obtener ediciones
  const { data: issues } = await supabase
    .from('issues')
    .select('issue_number, published_at, publications(slug)')
    .eq('is_published', true)

  const pubRoutes: MetadataRoute.Sitemap = (publications || []).map((pub) => ({
    url: `${base}/revistas/${pub.slug}`,
    lastModified: pub.created_at,
    priority: 0.9,
  }))

  const issueRoutes: MetadataRoute.Sitemap = (issues || []).map((issue: { issue_number: number; published_at: string; publications: { slug: string } | { slug: string }[] | null }) => {
    const pub = Array.isArray(issue.publications) ? issue.publications[0] : issue.publications
    return {
      url: `${base}/revistas/${pub?.slug}/${issue.issue_number}`,
      lastModified: issue.published_at,
      priority: 0.7,
    }
  })

  return [
    { url: base, priority: 1.0, lastModified: new Date().toISOString() },
    { url: `${base}/anunciantes`, priority: 0.8, lastModified: new Date().toISOString() },
    ...pubRoutes,
    ...issueRoutes,
  ]
}
