import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { phoneToEmail } from '@/lib/utils'

export async function POST() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const svc = createServiceClient()

  const { data: profile } = await svc
    .from('profiles')
    .select('phone, role')
    .eq('id', user.id)
    .single()

  if (!profile?.phone || profile.role !== 'customer') {
    return NextResponse.json({ ok: true })
  }

  const phoneEmail = phoneToEmail(profile.phone)

  if (user.email === phoneEmail) {
    return NextResponse.json({ ok: true })
  }

  await svc.auth.admin.updateUserById(user.id, {
    email: phoneEmail,
    email_confirm: true,
  })

  return NextResponse.json({ ok: true })
}
