import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// These paths skip the "must be logged in" admin guard
const ADMIN_PUBLIC_PATHS = ['/admin/login', '/admin/forgot-password', '/admin/reset-password']
// These paths additionally redirect logged-in users away to dashboard
// (reset-password is excluded — user must be logged in to set a new password)
const ADMIN_AUTH_ONLY_PATHS = ['/admin/login', '/admin/forgot-password']

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
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  const isAdminPublicPath = ADMIN_PUBLIC_PATHS.some(p => pathname.startsWith(p))
  const isAdminAuthOnlyPath = ADMIN_AUTH_ONLY_PATHS.some(p => pathname.startsWith(p))
  const isCustomerAuthRoute = CUSTOMER_AUTH_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))
  const isAdminBlockedRoute = ADMIN_BLOCKED_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))
  const isAdminRoute = pathname.startsWith('/admin') && !isAdminPublicPath

  // ── Unauthenticated guards (no DB query needed) ──────────────────────────────
  if (!user) {
    if (isCustomerAuthRoute) return NextResponse.redirect(new URL('/login', request.url))
    if (isAdminRoute) return NextResponse.redirect(new URL('/admin/login', request.url))
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
    return NextResponse.redirect(new URL(isAdmin ? '/admin/dashboard' : '/account', request.url))
  }

  // ── Admin on customer-facing route → admin dashboard ─────────────────────────
  if (isAdmin && isAdminBlockedRoute) {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url))
  }

  // ── Non-admin on protected admin route → customer home ───────────────────────
  if (isAdminRoute && !isAdmin) {
    return NextResponse.redirect(new URL('/account', request.url))
  }

  // ── Superadmin-only paths ─────────────────────────────────────────────────────
  if (
    isAdminRoute &&
    (pathname.startsWith('/admin/staff') || pathname.startsWith('/admin/export')) &&
    role !== 'superadmin'
  ) {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
