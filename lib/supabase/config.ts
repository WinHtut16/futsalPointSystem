/**
 * One place that decides which Supabase hostname each runtime talks to.
 *
 * Two URLs are in play, and mixing them up silently breaks sessions:
 *
 *   SUPABASE_URL           The real project, https://<ref>.supabase.co.
 *                          Used by everything executing on Vercel — server
 *                          components, route handlers, middleware, the service
 *                          client. Vercel (sin1) → Supabase never crosses a
 *                          customer's ISP, so filtering cannot touch it.
 *
 *   browserSupabaseUrl()   The same-origin passthrough, https://<app>/sb,
 *                          rewritten to Supabase in next.config.js. Used by the
 *                          browser only.
 *
 * Why the browser needs its own URL — measured on 2026-08-22, one Samsung handset,
 * two networks, 74 seconds apart:
 *
 *   Ooredoo mobile   auth  BLOCKED 254/180/629ms      "Failed to fetch"
 *                    rest  BLOCKED 170/139/465ms      "Failed to fetch"
 *                    ws    BLOCKED  76/ 57/520ms      "connection refused"
 *                    /sb        OK 236/265/233ms      HTTP 200
 *   The same phone on WiFi     OK on every probe.
 *
 * Sub-300ms failures are a refused connection, not a slow one: the operator is
 * rejecting the name, not dropping packets. Requests to /sb are indistinguishable
 * on the wire from any other request to this app, so there is no supabase.co
 * hostname left for a filter to match.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/** Must stay in sync with the rewrite source in next.config.js. */
export const SUPABASE_PROXY_PATH = '/sb'

/**
 * supabase-js derives its session cookie as `sb-${hostname.split('.')[0]}-auth-token`
 * from whatever URL it was handed (SupabaseClient constructor, `defaultStorageKey`).
 * Because the browser is now handed a different URL than the server, that default
 * would produce two different cookie names — the browser writing one, middleware
 * reading the other, every visitor permanently logged out. Both sides pin this
 * instead, derived from the real project URL so it matches what already exists in
 * customers' browsers today. Changing it logs everyone out once.
 */
function projectRef(url: string): string {
  try {
    return new URL(url).hostname.split('.')[0]
  } catch {
    // Malformed/missing env var: fall back to a constant so both sides still agree.
    return 'supabase'
  }
}

export const SUPABASE_AUTH_COOKIE_NAME = `sb-${projectRef(SUPABASE_URL)}-auth-token`

export function browserSupabaseUrl(): string {
  // Server-side render of a client component: no window, and no reason to take
  // the extra hop. Origin-relative keeps this correct on preview deployments and
  // on any custom domain added later, with nothing to reconfigure.
  if (typeof window === 'undefined') return SUPABASE_URL
  return `${window.location.origin}${SUPABASE_PROXY_PATH}`
}
