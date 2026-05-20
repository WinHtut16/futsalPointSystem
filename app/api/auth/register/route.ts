import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { phoneToEmail, normalizePhone } from '@/lib/utils'

export async function POST(request: NextRequest) {
  const { phone, username, password } = await request.json()

  const normalized = normalizePhone(phone ?? '')

  if (!/^09\d{7,9}$/.test(normalized)) {
    return NextResponse.json(
      { error: 'Enter a valid Myanmar phone number (e.g. 09XXXXXXXXX).' },
      { status: 400 }
    )
  }
  if (!username || username.trim().length < 2) {
    return NextResponse.json({ error: 'Username must be at least 2 characters.' }, { status: 400 })
  }
  if (!password || password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 })
  }

  const supabase = await createServiceClient()

  // Check if phone already registered
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('phone', normalized)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'This phone number is already registered.' },
      { status: 409 }
    )
  }

  // Create auth user via admin API — bypasses email sending + rate limits entirely
  const { error } = await supabase.auth.admin.createUser({
    email: phoneToEmail(normalized),
    password,
    email_confirm: true,
    user_metadata: { phone: normalized, username: username.trim() },
  })

  if (error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('already') || msg.includes('exists')) {
      return NextResponse.json(
        { error: 'This phone number is already registered.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
