import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { fetchWithTimeout, MIDDLEWARE_AUTH_TIMEOUT_MS } from '@/lib/fetchWithTimeout'
import { SUPABASE_AUTH_COOKIE_NAME } from '@/lib/supabase/config'

// These paths skip the "must be logged in" admin guard
const ADMIN_PUBLIC_PATHS = ['/admin/login', '/admin/forgot-password', '/admin/reset-password']
// These paths additionally redirect logged-in users away to dashboard
// (reset-password is excluded — user must be logged in to set a new password)
const ADMIN_AUTH_ONLY_PATHS = ['/admin/login', '/admin/forgot-password']

// Admin paths served by another deployment (Next.js zones, rewritten in
// next.config.js). Entering one needs a grant for that specific business, not
// merely an admin role.
const ZONE_PREFIXES: { path: string; app: string }[] = [
  { path: '/admin/billiards', app: 'billiards' },
]

// Routes that require a logged-in session (any role)
const CUSTOMER_AUTH_ROUTES = ['/dashboard', '/history', '/rewards', '/bookings', '/account']
// Customer-facing routes that an authenticated admin should never land on — redirect to admin panel.
// Note: /book is listed here but NOT in CUSTOMER_AUTH_ROUTES because it is publicly accessible
// (unauthenticated visitors see a login-to-book CTA). Only logged-in admins are redirected away.
const ADMIN_BLOCKED_ROUTES = ['/dashboard', '/bookings', '/book', '/rewards', '/account']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Must match what the browser client writes; see lib/supabase/config.ts.
      cookieOptions: { name: SUPABASE_AUTH_COOKIE_NAME },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
      global: {
        fetch: (input, init) => fetchWithTimeout(input, init, MIDDLEWARE_AUTH_TIMEOUT_MS),
      },
    }
  )

  // Bounded + defensive: a slow or erroring Supabase call (timeout, or a thrown
  // AuthApiError e.g. stale/invalid refresh token cookie) must not hang or crash
  // this function — Vercel force-kills middleware that doesn't respond within 25s.
  // Falling back to user=null reuses the existing "logged out" redirect below,
  // no new branching needed.
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'] = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    user = null
  }
  const { pathname } = request.nextUrl

  const isAdminPublicPath = ADMIN_PUBLIC_PATHS.some(p => pathname.startsWith(p))
  const isAdminAuthOnlyPath = ADMIN_AUTH_ONLY_PATHS.some(p => pathname.startsWith(p))
  const isCustomerAuthRoute = CUSTOMER_AUTH_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))
  const isAdminBlockedRoute = ADMIN_BLOCKED_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))
  const isAdminRoute = pathname.startsWith('/admin') && !isAdminPublicPath

  // ── Unauthenticated guards (no DB query needed) ──────────────────────────────
  if (!user) {
    if (isCustomerAuthRoute) return NextResponse.redirect(new URL('/login', request.url))
    if (isAdminRoute) {
      // Carry the intended destination so a deep link survives the login round
      // trip. This matters more once billiards and game arrive as zones under
      // /admin/*: a bookmark to a specific POS screen should still land there.
      const loginUrl = new URL('/admin/login', request.url)
      loginUrl.searchParams.set('next', pathname + request.nextUrl.search)
      return NextResponse.redirect(loginUrl)
    }
    return supabaseResponse
  }

  // ── Role check ───────────────────────────────────────────────────────────────
  // Customer accounts always use {phone}@akoatp.com — confirmed customer emails skip the
  // DB query on customer routes to avoid per-request overhead on high-traffic paths.
  // Staff admin emails end @akoatp-staff.com; superadmin uses a real email — both trigger
  // the fetch when visiting an admin-blocked route.
  const isConfirmedCustomerEmail = (user.email ?? '').endsWith('@akoatp.com')
  const needsRoleCheck =
    isAdminAuthOnlyPath ||
    pathname === '/login' ||
    pathname === '/register' ||
    isAdminRoute ||
    (isAdminBlockedRoute && !isConfirmedCustomerEmail)

  let role: string | null = null
  if (needsRoleCheck) {
    const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    role = data?.role ?? null
  }

  const isAdmin = role === 'admin' || role === 'superadmin'

  // ── Logged-in user on auth pages → redirect to their home ────────────────────
  if (pathname === '/login' || pathname === '/register' || isAdminAuthOnlyPath) {
    return NextResponse.redirect(new URL(isAdmin ? '/admin' : '/account', request.url))
  }

  // ── Admin on customer-facing route → admin panel ─────────────────────────────
  // Targets /admin rather than /admin/dashboard so that a billiards-only admin
  // is not bounced into a futsal screen they hold no grant for.
  if (isAdmin && isAdminBlockedRoute) {
    return NextResponse.redirect(new URL('/admin', request.url))
  }

  // ── Non-admin on protected admin route → customer home ───────────────────────
  if (isAdminRoute && !isAdmin) {
    return NextResponse.redirect(new URL('/account', request.url))
  }

  // ── Zone routes need a grant for THAT business ────────────────────────────────
  // Checked here so an admin without the grant never reaches the zone at all,
  // rather than being bounced back out of it. The zone re-checks server-side
  // anyway; this is the cheap first gate, and it costs nothing on /admin/* paths
  // that are not zones.
  const zone = ZONE_PREFIXES.find(z => pathname === z.path || pathname.startsWith(z.path + '/'))
  if (zone) {
    // A global superadmin passes every app by definition, and `role` is already
    // in hand from the query above - so the owner and manager, who click around
    // the most, skip the RPC entirely. Everyone else pays one lookup. Same
    // short-circuit as the superadmin-only paths below; it is worth the four
    // lines because this middleware sits in front of every zone request and
    // each Supabase round trip is ~95ms from Singapore to Sydney.
    let allowed = role === 'superadmin'
    if (!allowed) {
      try {
        const { data } = await supabase.rpc('has_app_access', { p_app: zone.app })
        allowed = data === true
      } catch {
        allowed = false
      }
    }
    if (!allowed) return NextResponse.redirect(new URL('/admin/apps', request.url))
  }

  // ── Superadmin-only paths ─────────────────────────────────────────────────────
  if (
    isAdminRoute &&
    (pathname.startsWith('/admin/staff') || pathname.startsWith('/admin/export'))
  ) {
    // A global superadmin passes without any extra work, which is every
    // superadmin today - so this costs nothing on the current data. Only a
    // plain admin pays for the app_role lookup, and only on these two rarely
    // visited paths, never on the hot admin routes.
    let allowed = role === 'superadmin'
    if (!allowed) {
      try {
        const { data } = await supabase.rpc('app_role', { p_app: 'futsal' })
        allowed = data === 'superadmin'
      } catch {
        allowed = false
      }
    }
    if (!allowed) return NextResponse.redirect(new URL('/admin/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // sb/ is the same-origin Supabase passthrough (next.config.js rewrites) — running
    // auth middleware on proxied API traffic would add a getUser() round trip to every
    // single Supabase call and rewrite its cookies. It must pass straight through.
    //
    // net-check is the standalone network diagnostic. It must render even when
    // Supabase is unreachable, so it cannot sit behind a getUser() call that would
    // spend 5s timing out before the page appears.
    //
    // sw.js and pwa/ (manifest + icons) are excluded so the admin PWA's
    // service-worker update checks and manifest fetch never hit the
    // Supabase getUser() round-trip below — those requests carry no
    // session cookie and would otherwise 307 to /admin/login.
    '/((?!_next/static|_next/image|favicon.ico|api/|sb/|net-check|sw\\.js|pwa/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
