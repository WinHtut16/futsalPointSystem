import { safeRedirect } from '@/lib/utils'

// Customer points portals for the two venues on the park site.
// Futsal keeps /account; ACJ Gaming and CueX Billiards each get their own page
// under their park page, with the same login and a wallet per business.

export const VENUES = ['game', 'billiards'] as const
export type Venue = (typeof VENUES)[number]

export const VENUE_PORTAL: Record<Venue, string> = {
  game: '/games/account',
  billiards: '/billiards/account',
}

/** The venue's public park page (where the portal's back link goes). */
export const VENUE_PAGE: Record<Venue, string> = {
  game: '/games',
  billiards: '/billiards',
}

export function isVenue(value: unknown): value is Venue {
  return typeof value === 'string' && (VENUES as readonly string[]).includes(value)
}

/**
 * Back arrow on /account/settings. Only the known portal paths are accepted,
 * so the query string cannot send anyone elsewhere.
 */
export function settingsBackHref(back: string | null | undefined): string {
  const portals: readonly string[] = Object.values(VENUE_PORTAL)
  return back && portals.includes(back) ? back : '/account'
}

/**
 * Where a signed-in customer who opens /login or /register is sent: the page
 * they were heading to (`next`), else the venue portal a counter QR code named
 * (`from=game|billiards`), else futsal's /account.
 */
export function customerLanding(next: string | null, from: string | null): string {
  if (next) return safeRedirect(next, '/account')
  return isVenue(from) ? VENUE_PORTAL[from] : '/account'
}

/** One played session, as returned by public.my_venue_sessions. */
export type VenueSession = {
  id: string
  played_at: string
  place: string | null
  paid_minutes: number
  voided: boolean
  points: number
}

export const SESSIONS_PAGE = 20

/** Defensive parse of the function's jsonb array. Bad rows are dropped. */
export function parseVenueSessions(raw: unknown): VenueSession[] {
  if (!Array.isArray(raw)) return []
  const out: VenueSession[] = []
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    if (typeof o.id !== 'string' || typeof o.played_at !== 'string') continue
    out.push({
      id: o.id,
      played_at: o.played_at,
      place: typeof o.place === 'string' ? o.place : null,
      paid_minutes: Number(o.paid_minutes) || 0,
      voided: o.voided === true,
      points: Number(o.points) || 0,
    })
  }
  return out
}

/** "2h 15m" / "45m"; the timeline shows paid time this way. */
export function formatMinutes(min: number): string {
  const m = Math.max(0, Math.round(min))
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h === 0) return `${r}m`
  return r === 0 ? `${h}h` : `${h}h ${r}m`
}
