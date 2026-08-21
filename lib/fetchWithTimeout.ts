/**
 * Bounded-latency fetch wrapper. Same AbortController + setTimeout pattern as
 * broadcastSlotChange() in lib/supabase/server.ts, but this one surfaces the
 * error instead of swallowing it — callers on the critical auth path need to
 * know a request timed out so they can show an honest "connection" message
 * instead of hanging indefinitely or misreporting it as invalid credentials.
 */

export class TimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`)
    this.name = 'TimeoutError'
  }
}

// Every Supabase call made through the browser client (login, booking, points, realtime REST, etc.)
export const SUPABASE_CLIENT_TIMEOUT_MS = 15000
// middleware.getUser() must resolve well under Vercel's 25s function kill
export const MIDDLEWARE_AUTH_TIMEOUT_MS = 5000
// POST /api/auth/register
export const REGISTER_POST_TIMEOUT_MS = 20000

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const signal = init?.signal ? AbortSignal.any([controller.signal, init.signal]) : controller.signal
  try {
    return await fetch(input, { ...init, signal })
  } catch (err) {
    if (controller.signal.aborted && !(init?.signal?.aborted)) {
      throw new TimeoutError(timeoutMs)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

/**
 * True for our own timeout, a caller-initiated abort, or a raw network failure —
 * including supabase-js's own wrapping of a failed fetch as AuthRetryableFetchError
 * (auth-js's _handleRequest catches "fetch() itself throws" and re-throws that
 * shape; duck-typed by name here rather than importing @supabase/auth-js types
 * into a generic utility).
 */
export function isTimeoutOrNetworkError(err: unknown): boolean {
  if (err instanceof TimeoutError) return true
  if (err instanceof Error && err.name === 'AbortError') return true
  if (err instanceof TypeError && /fetch/i.test(err.message)) return true
  if (err && typeof err === 'object' && 'name' in err && err.name === 'AuthRetryableFetchError') return true
  return false
}
