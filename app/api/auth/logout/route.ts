import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export const maxDuration = 15

/**
 * Sign-out done server-side. supabase-js's client-side signOut() calls Supabase's
 * /logout endpoint over the network and only clears local session cookies AFTER
 * that call succeeds — if the browser's direct connection to *.supabase.co is
 * blocked (confirmed happening for some Myanmar users without a VPN), the call
 * fails, cookies are never cleared, and the UI shows "logged out" while the
 * session stays valid.
 *
 * Vercel calling Supabase is server-to-server and never crosses the user's own
 * ISP, so it isn't subject to that block. The browser only needs to reach our
 * own domain (already confirmed reachable without VPN) to log out reliably.
 */
export async function POST(request: NextRequest) {
  const pendingCookies: { name: string; value: string; options: CookieOptions }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          pendingCookies.push(...cookiesToSet)
        },
      },
    }
  )

  await supabase.auth.signOut().catch(() => {})

  const response = NextResponse.json({ success: true })
  for (const { name, value, options } of pendingCookies) {
    response.cookies.set(name, value, options)
  }

  // Belt-and-suspenders: force-expire every Supabase auth cookie this request
  // carried, even if signOut()'s own cookie removal above never ran (e.g.
  // Supabase itself briefly unreachable even from Vercel). Guarantees the
  // browser is logged out regardless of what happened upstream.
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith('sb-')) {
      response.cookies.set(cookie.name, '', { maxAge: 0, path: '/' })
    }
  }

  return response
}
