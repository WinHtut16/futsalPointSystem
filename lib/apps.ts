import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { TranslationKey } from '@/lib/i18n'

/**
 * The three businesses behind the shared admin portal.
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
}

export const APPS: Record<AppName, AppMeta> = {
  futsal: {
    name: 'futsal',
    href: '/admin/dashboard',
    titleKey: 'portal.futsalTitle',
    descKey: 'portal.futsalDesc',
    accent: '#0b4327',
    live: true,
  },
  billiards: {
    name: 'billiards',
    href: '/admin/billiards',
    titleKey: 'portal.billiardsTitle',
    descKey: 'portal.billiardsDesc',
    accent: '#8a3324',
    live: false,
  },
  game: {
    name: 'game',
    href: '/admin/game',
    titleKey: 'portal.gameTitle',
    descKey: 'portal.gameDesc',
    accent: '#2f5fd0',
    live: false,
  },
}

function isAppName(value: string): value is AppName {
  return (APP_NAMES as readonly string[]).includes(value)
}

function isAppRole(value: unknown): value is AppRole {
  return value === 'admin' || value === 'superadmin'
}

/**
 * Every business the signed-in admin may enter, with their rank in each.
 *
 * One round trip. The precedence rule — a global superadmin outranks any
 * per-app row — lives in Postgres (my_apps/app_role) rather than here, so the
 * RLS policies and the application can never drift apart on who counts as what.
 */
export const getMyApps = cache(async (): Promise<AppGrant[] | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('my_apps')
  // null means "could not determine", which is NOT the same as "no access".
  // Callers must not revoke on null, or a momentary DB blip locks out every
  // admin on a live system.
  if (error) return null
  if (!data) return []
  return (data as { app: string; role: string }[])
    .filter((row) => isAppName(row.app) && isAppRole(row.role))
    .map((row) => ({ app: row.app as AppName, role: row.role as AppRole }))
})

/**
 * Rank in one business, or null when the caller cannot enter it at all.
 * Note the failure mode is deliberate: a transient DB error returns null, i.e.
 * denies. Never invert this to "allow on error".
 */
export const getAppRole = cache(async (app: AppName): Promise<AppRole | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('app_role', { p_app: app })
  if (error || !isAppRole(data)) return null
  return data
})

export async function hasAppAccess(app: AppName): Promise<boolean> {
  return (await getAppRole(app)) !== null
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
