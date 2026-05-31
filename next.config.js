/** @type {import('next').NextConfig} */
const csp = [
  "default-src 'self'",
  // Next.js dev HMR + React hydration require unsafe-inline/unsafe-eval
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://res.cloudinary.com",
  "font-src 'self'",
  // Supabase REST + Realtime websocket
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-src 'self' https://www.google.com https://maps.google.com https://maps.googleapis.com https://www.facebook.com https://www.facebook.com/plugins/",
  "frame-ancestors 'none'",
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
    ]
  },
}

module.exports = nextConfig
