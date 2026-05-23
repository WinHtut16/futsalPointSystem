import { NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  // Only allow same-origin relative paths; reject absolute URLs, //evil.com, \bypasses
  const rawNext = searchParams.get('next') ?? ''
  const next = /^\/[^/\\]/.test(rawNext) ? rawNext : '/admin/login'

  const supabase = await createClient()

  // PKCE flow: ?code=  (older Supabase projects / explicit PKCE)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(new URL(next, origin))
    }
  }

  // OTP/email-link flow: ?token_hash=&type=  (supabase-js 2.x default for email links)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error) {
      return NextResponse.redirect(new URL(next, origin))
    }
  }

  return NextResponse.redirect(new URL('/admin/login?error=invalid_link', origin))
}
