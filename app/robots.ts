import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/park/site'

// Public pages are crawlable; accounts, admin, APIs and the Supabase proxy are not.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api/', '/sb/', '/account', '/bookings', '/history', '/dashboard', '/rewards', '/auth/', '/net-check'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
