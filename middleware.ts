import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// These paths skip the "must be logged in" admin guard
const ADMIN_PUBLIC_PATHS = ['/admin/login', '/admin/forgot-password', '/admin/reset-password']
// These paths additionally redirect logged-in users away to dashboard
// (reset-password is excluded — user must be logged in to set a new password)
const ADMIN_AUTH_ONLY_PATHS = ['/admin/login', '/admin/forgot-password']

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

  // Redirect logged-in users away from login/forgot-password (but not reset-password)
  if (user && (pathname === '/login' || pathname === '/register' || isAdminAuthOnlyPath)) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdminRole = profile?.role === 'admin' || profile?.role === 'superadmin'
    const destination = isAdminRole ? '/admin/dashboard' : '/dashboard'
    return NextResponse.redirect(new URL(destination, request.url))
  }

  // Protect customer routes — role check delegated to layout (saves 1 DB round trip per request)
  const customerRoutes = ['/dashboard', '/history', '/rewards']
  if (customerRoutes.some((r) => pathname.startsWith(r))) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // Protect admin routes (excluding public admin auth pages)
  if (pathname.startsWith('/admin') && !isAdminPublicPath) {
    if (!user) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdminRole = profile?.role === 'admin' || profile?.role === 'superadmin'
    if (!isAdminRole) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Staff management is superadmin-only
    if (pathname.startsWith('/admin/staff') && profile?.role !== 'superadmin') {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
