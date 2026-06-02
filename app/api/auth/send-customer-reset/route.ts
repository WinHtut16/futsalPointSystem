// TODO: Add rate limiting in production to prevent abuse.
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { hasRealEmail } from '@/lib/auth/hasRealEmail'

function normalizePhone(raw: string): string {
  let phone = raw.trim().replace(/\s+/g, '')
  if (phone.startsWith('+95')) {
    phone = '0' + phone.slice(3)
  }
  return phone
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const rawPhone = (body as { phone?: unknown }).phone
  if (typeof rawPhone !== 'string' || !rawPhone.trim()) {
    return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
  }
  const phone = normalizePhone(rawPhone)

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('phone', phone)
    .maybeSingle()

  if (!profile) {
    // Don't reveal whether a phone number is registered
    return NextResponse.json({ success: true })
  }

  const { data: { user } } = await supabase.auth.admin.getUserById(profile.id)

  if (!user || !hasRealEmail(user.email)) {
    return NextResponse.json(
      { error: 'No email address on this account.' },
      { status: 400 }
    )
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  await supabase.auth.resetPasswordForEmail(user.email!, {
    redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
  })

  return NextResponse.json({ success: true })
}