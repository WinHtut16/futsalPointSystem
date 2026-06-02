import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { hasRealEmail, maskEmail } from '@/lib/auth/hasRealEmail'

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
    return NextResponse.json({ found: false, hasEmail: false, maskedEmail: null })
  }

  const { data: { user } } = await supabase.auth.admin.getUserById(profile.id)

  if (!user) {
    return NextResponse.json({ found: false, hasEmail: false, maskedEmail: null })
  }

  const realEmail = hasRealEmail(user.email)
  return NextResponse.json({
    found: true,
    hasEmail: realEmail,
    maskedEmail: realEmail ? maskEmail(user.email!) : null,
  })
}