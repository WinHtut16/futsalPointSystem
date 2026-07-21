/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === 'development'

// CSP notes:
// - 'unsafe-eval': only in dev (Next.js HMR source-maps). Not needed in production —
//   no eval()/new Function()/dangerouslySetInnerHTML in this codebase.
// - 'unsafe-inline' in script-src: accepted known risk. Removing it requires nonce
//   injection via middleware (app/layout.tsx reads x-nonce header → passes to <Script>).
//   TODO: implement CSP nonces when ready to remove unsafe-inline.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://res.cloudinary.com",
  "font-src 'self'",
  // Supabase REST + Realtime websocket
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-src 'self' https://www.google.com https://maps.google.com https://maps.googleapis.com https://www.facebook.com https://www.facebook.com/plugins/",
  "frame-ancestors 'none'",
  // Admin PWA install (public/pwa/manifest.webmanifest, public/sw.js).
  "manifest-src 'self'",
  "worker-src 'self'",
].join('; ')

const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
      {
        // Admin PWA service worker — must revalidate on every fetch so a
        // redeployed worker (and thus the passthrough no-caching behavior)
        // is picked up immediately, never served stale from an HTTP cache.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
