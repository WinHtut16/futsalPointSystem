import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/park/site'

export default function sitemap(): MetadataRoute.Sitemap {
  const pages: [string, number][] = [
    ['/', 1],
    ['/pool', 0.8],
    ['/games', 0.8],
    ['/billiards', 0.8],
    ['/futsal', 0.8],
    ['/book', 0.7],
    ['/news', 0.6],
  ]
  return pages.map(([path, priority]) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: 'weekly',
    priority,
  }))
}
