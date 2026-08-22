import { createBrowserClient } from '@supabase/ssr'
import { fetchWithTimeout, SUPABASE_CLIENT_TIMEOUT_MS } from '@/lib/fetchWithTimeout'
import {
  SUPABASE_ANON_KEY,
  SUPABASE_AUTH_COOKIE_NAME,
  browserSupabaseUrl,
} from '@/lib/supabase/config'

/**
 * Realtime cannot follow REST through the proxy: Vercel does not upgrade
 * WebSocket connections across a rewrite. Channels opened from the browser will
 * therefore fail to connect. Every consumer already refreshes on an interval or
 * on tab focus, so nothing depends on them — but the default backoff settles at
 * one retry every 10s, which is pure waste on a customer's mobile data for a
 * connection that cannot succeed. One attempt a minute keeps the code path alive
 * (it costs nothing if a future host does support the upgrade) without the noise.
 */
const REALTIME_RETRY_MS = 60_000

export function createClient() {
  return createBrowserClient(browserSupabaseUrl(), SUPABASE_ANON_KEY, {
    cookieOptions: { name: SUPABASE_AUTH_COOKIE_NAME },
    realtime: { reconnectAfterMs: () => REALTIME_RETRY_MS },
    global: {
      fetch: (input, init) => fetchWithTimeout(input, init, SUPABASE_CLIENT_TIMEOUT_MS),
    },
  })
}
