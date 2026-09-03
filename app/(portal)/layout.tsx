import type { Metadata, Viewport } from 'next'

/**
 * Chrome-free shell for the portal routes (/admin and /admin/apps).
 *
 * Deliberately NOT inside the (admin) group: that layout renders the futsal
 * sidebar and runs the pending-redemption and pending-booking count queries,
 * neither of which belongs on a page whose only job is to ask which business
 * you want to open.
 *
 * The PWA metadata is repeated here because /admin is the installed app's
 * start_url. Without a manifest link on the launch page some browsers drop the
 * window out of standalone display on open. Scope stays "/admin" in the
 * manifest itself, so this still never reaches customer-facing routes.
 */
export const metadata: Metadata = {
  manifest: '/pwa/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'MyaThida Admin', statusBarStyle: 'default' },
  icons: { icon: '/logo_black.jpg', apple: '/pwa/apple-touch-icon-180.png' },
}

export const viewport: Viewport = {
  themeColor: '#0b4327',
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  // data-font-scope="admin" repoints --font-display/--font-body to the shared
  // Plex admin stack (see globals.css) — this route is staff-facing (the
  // business chooser), not the customer brand.
  return <div data-font-scope="admin">{children}</div>
}
