import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { phoneToEmail, normalizePhone } from '@/lib/utils'
import { RegisterSchema, badRequest, parseJson } from '@/lib/schemas'

export async function POST(request: NextRequest) {
  const body = await parseJson(request)
  const parsed = RegisterSchema.safeParse(
    body && typeof body === 'object'
      ? { ...body, phone: typeof (body as { phone?: unknown }).phone === 'string' ? normalizePhone((body as { phone: string }).phone) : (body as { phone?: unknown }).phone }
      : body
  )
  if (!parsed.success) return badRequest(parsed.error)
  const { phone, username, password } = parsed.data

  const supabase = await createServiceClient()

  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('phone', phone)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'This phone number is already registered.' },
      { status: 409 }
    )
  }

  const { error } = await supabase.auth.admin.createUser({
    email: phoneToEmail(phone),
    password,
    email_confirm: true,
    user_metadata: { phone, username: username.trim() },
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

  return NextResponse.json({ success: true }, { status: 201 })
}
