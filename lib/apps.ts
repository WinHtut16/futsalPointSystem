import type { TranslationKey } from '@/lib/i18n'

/**
 * The three businesses behind the shared admin portal.
 *
 * PURE ON PURPOSE - constants and types only, safe to import from a client
 * component. The server-side lookups (getMyApps, getAppRole, hasAppAccess)
 * live in ./apps.server, which reaches next/headers and must never be pulled
 * into a browser bundle.
 *
 * They used to share this file, and that was a trap: AppAccessPanel is a
 * client component and imported APPS from here, which dragged the whole
 * module - Supabase server client and all - into the client graph and broke
 * the production build. tsc does not see the server/client boundary, so the
 * split is what prevents it, not the type checker.
 *
 * This tuple is the single source of truth for app names, and every function
 * that takes one takes `AppName` rather than `string`. That matters: in
 * Postgres, has_app_access('billards') returns FALSE rather than raising — a
 * typo fails safe but silently, and would be a miserable bug to chase from a
 * "why can't this admin get in?" report. Here it is a compile error instead.
 */
export const APP_NAMES = ['futsal', 'billiards', 'game'] as const
export type AppName = (typeof APP_NAMES)[number]

/** Rank held *within* one business. Mirrors app_access.role in Postgres. */
export type AppRole = 'admin' | 'superadmin'

export interface AppGrant {
  app: AppName
  role: AppRole
}

export interface AppMeta {
  name: AppName
  /**
   * Where this business's admin panel lives. All three are paths on this
   * origin, not absolute URLs — billiards and game arrive as Next.js zones
   * rewritten from here, which is what lets one session cookie cover all
   * three without a custom domain.
   */
  href: string
  titleKey: TranslationKey
  descKey: TranslationKey
  /** Identity colour for the portal tile. */
  accent: string
  /** False until that zone is actually deployed; its tile renders disabled. */
  live: boolean
  /**
   * True when this panel is a SEPARATE Next.js deployment reached through a
   * rewrite, rather than a route of this app.
   *
   * Links to one of these must be a plain <a>, never next/link. next/link makes
   * this app's router try a soft navigation into an app it does not own: it asks
   * the zone for an RSC payload describing THIS app's router tree, the zone
   * cannot answer that, and the request 404s - once when the link is prefetched
   * and again when it is clicked. The zones already link back here the same way,
   * with plain <a>, for the mirror-image reason (their basePath would otherwise
   * be prepended to a hub path).
   */
  crossZone: boolean
}

export const APPS: Record<AppName, AppMeta> = {
  futsal: {
    name: 'futsal',
    href: '/admin/dashboard',
    titleKey: 'portal.futsalTitle',
    descKey: 'portal.futsalDesc',
    accent: '#0b4327',
    live: true,
    crossZone: false,
  },
  billiards: {
    name: 'billiards',
    href: '/admin/billiards',
    titleKey: 'portal.billiardsTitle',
    descKey: 'portal.billiardsDesc',
    accent: '#8a3324',
    live: true,
    crossZone: true,
  },
  game: {
    name: 'game',
    href: '/admin/game',
    titleKey: 'portal.gameTitle',
    descKey: 'portal.gameDesc',
    accent: '#2f5fd0',
    live: true,
    crossZone: true,
  },
}

export function isAppName(value: string): value is AppName {
  return (APP_NAMES as readonly string[]).includes(value)
}

export function isAppRole(value: unknown): value is AppRole {
  return value === 'admin' || value === 'superadmin'
}

/**
 * Where an admin should land after signing in, or on opening the installed app.
 *
 * One business goes straight in — a billiards floor worker should never tap
 * through a chooser showing a single tile every shift. Everyone else gets
 * /admin/apps, which also renders the "no access" state for the zero case
 * rather than bouncing to /account (which middleware would send an admin
 * straight back from, producing a redirect loop).
 */
export function landingFor(apps: AppGrant[] | null): string {
  // Unknown: fall back to the pre-portal behaviour rather than stranding
  // someone on a chooser that would wrongly claim they have no access.
  if (apps === null) return APPS.futsal.href
  if (apps.length === 1) return APPS[apps[0].app].href
  return '/admin/apps'
}
