import { NextRequest, NextResponse } from 'next/server'

/**
 * Network diagnostic endpoint (public, no auth).
 *
 * Exists to answer one question: when a Myanmar customer cannot register or log in,
 * WHICH hop is broken? The browser half of the test lives in app/net-check/page.tsx;
 * this route supplies the two things the browser cannot see for itself:
 *
 *   1. Whether Vercel itself is reachable at all, and how fast.
 *   2. Whether Vercel -> Supabase is healthy. If this is fast but the browser's own
 *      direct call to *.supabase.co is not, the fault is between the customer's ISP
 *      and Supabase -- not our code, and not Supabase being down.
 *
 * force-dynamic + no-store: a cached response would measure nothing.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 15

const PROBE_TIMEOUT_MS = 8000

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  let supabaseFromVercel: { ms: number; ok: boolean; detail: string }
  const started = Date.now()

  if (!supabaseUrl || !anonKey) {
    supabaseFromVercel = { ms: 0, ok: false, detail: 'env vars missing on server' }
  } else {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
    try {
      const res = await fetch(`${supabaseUrl}/auth/v1/health`, {
        headers: { apikey: anonKey },
        signal: controller.signal,
        cache: 'no-store',
      })
      supabaseFromVercel = { ms: Date.now() - started, ok: res.ok, detail: `HTTP ${res.status}` }
    } catch (err) {
      supabaseFromVercel = {
        ms: Date.now() - started,
        ok: false,
        detail: controller.signal.aborted ? `no response in ${PROBE_TIMEOUT_MS / 1000}s` : (err instanceof Error ? err.message : 'failed'),
      }
    } finally {
      clearTimeout(timer)
    }
  }

  const h = request.headers

  return NextResponse.json(
    {
      serverTime: new Date().toISOString(),
      // Set by Vercel at runtime; 'local' when running `next dev`.
      vercelRegion: process.env.VERCEL_REGION ?? 'local',
      // Vercel geo headers -- tells us the request really did originate in Myanmar
      // (and not from a VPN exit node, which is the whole point of the test).
      clientCountry: h.get('x-vercel-ip-country'),
      clientCity: h.get('x-vercel-ip-city'),
      clientIp: (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || null,
      supabaseFromVercel,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
