/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === 'development'

/**
 * Supabase origin, resolved at build time because Next.js rewrites are baked into
 * the routing table rather than evaluated per request. Trailing slashes stripped so
 * `${supabaseOrigin}/:path*` cannot produce a double slash, which Supabase 404s on.
 */
const supabaseOrigin = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '')

/**
 * Provider-reachability probes on /net-check are opt-in, because switching them on
 * also has to widen connect-src below — the browser would otherwise block the very
 * requests we are trying to time, and report a CSP refusal as if it were an ISP one.
 *
 * Turn on by setting NEXT_PUBLIC_NETCHECK_PROVIDERS=1 in Vercel and redeploying;
 * turn it back off once the measurement is collected. Leaving the app's CSP
 * permanently wider for a one-off diagnostic is not a good trade.
 */
const probeProviders = process.env.NEXT_PUBLIC_NETCHECK_PROVIDERS === '1'
const providerProbeHosts = probeProviders
  ? ' https://*.googleapis.com https://*.firebaseio.com https://*.neon.tech https://neon.tech'
    + ' https://*.appwrite.io https://*.nhost.io https://nhost.io https://*.workers.dev'
    + ' https://firebase.google.com https://*.cloudflare.com https://neon.com'
  : ''

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
  // Supabase REST + Realtime websocket. Direct *.supabase.co stays listed while the
  // browser still calls it; the /sb proxy below is same-origin and covered by 'self'.
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co${providerProbeHosts}`,
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

  /**
   * Same-origin passthrough to Supabase.
   *
   * Myanmar ISPs filter by hostname, and several of them drop or reset traffic to
   * *.supabase.co — which is why registration and login fail for customers on some
   * operators and work perfectly on others. Requests to /sb/... are indistinguishable
   * on the wire from any other request to this app, so there is no supabase.co
   * hostname for a filter to match on.
   *
   * NOTE: nothing in the app points at this yet — app/net-check measures it so we can
   * prove it works on a blocked operator before switching real traffic over.
   *
   * NOTE: Vercel does not upgrade WebSocket connections through rewrites, so Realtime
   * (wss://) cannot use this path; that needs a polling fallback instead.
   */
  async rewrites() {
    if (!supabaseOrigin) return []
    return [
      { source: '/sb/:path*', destination: `${supabaseOrigin}/:path*` },
    ]
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
