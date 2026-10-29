import { MetadataRoute } from 'next'
import { EDICIONES_SD } from '@/lib/estatico'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://dework.com.ar'
  return [
    { url: base, priority: 1.0, lastModified: new Date().toISOString() },
    { url: `${base}/revistas/san-diego-la-revista`, priority: 0.9 },
    ...EDICIONES_SD.map(e => ({ url: `${base}/revistas/san-diego-la-revista/${e.issue_number}`, lastModified: e.published_at, priority: 0.7 })),
  ]
}
