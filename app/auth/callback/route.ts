import { NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  // Only allow same-origin relative paths; reject absolute URLs, //evil.com, \bypasses
  const rawNext = searchParams.get('next') ?? ''
  const next = /^\/[^/\\]/.test(rawNext) ? rawNext : '/admin/login'

  // Build redirect response first so setAll can attach session cookies directly to it.
  // Using createClient() from lib/supabase/server.ts won't work here: that client calls
  // cookieStore.set() from next/headers, which does NOT write Set-Cookie headers onto the
  // NextResponse.redirect() we return — the tokens are silently dropped and the next page
  // sees no session. The inline pattern below targets response.cookies.set() instead.
  const redirectResponse = NextResponse.redirect(new URL(next, origin))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            redirectResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // PKCE flow: ?code=  (browser-side PKCE verifier cookie must be present)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return redirectResponse
    }
  }

  // OTP/email-link flow: ?token_hash=&type=  (supabase-js 2.x default for email links)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error) {
      return redirectResponse
    }
  }

  return NextResponse.redirect(new URL('/admin/login?error=invalid_link', origin))
}
