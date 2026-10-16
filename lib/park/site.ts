// Public origin used for absolute URLs in metadata, Open Graph, the sitemap
// and structured data. The client's domain; override with PARK_SITE_URL for
// preview deployments.
export const SITE_URL = (process.env.PARK_SITE_URL ?? 'https://myathida-park.com').replace(/\/$/, '')
