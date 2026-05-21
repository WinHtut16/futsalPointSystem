import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // Only allow same-origin relative paths; reject absolute URLs, //evil.com, \bypasses
  const rawNext = searchParams.get('next') ?? ''
  const next = /^\/[^/\\]/.test(rawNext) ? rawNext : '/admin/login'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(new URL(next, origin))
    }
  }

  return NextResponse.redirect(new URL('/admin/login?error=invalid_link', origin))
}
