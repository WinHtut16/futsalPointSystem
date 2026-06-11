import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { CustomerProfileUpdateSchema, badRequest, parseJson, serverError } from '@/lib/schemas'
import { normalizePhone, phoneToEmail } from '@/lib/utils'

export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await parseJson(req)
  if (body && typeof body === 'object' && typeof (body as { phone?: unknown }).phone === 'string') {
    (body as { phone: string }).phone = normalizePhone((body as { phone: string }).phone)
  }
  const parsed = CustomerProfileUpdateSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error)

  const svc = await createServiceClient()
  const newPhone = parsed.data.phone

  if (newPhone !== undefined) {
    // Duplicate phone check — return 409 before any write
    const { data: existing } = await svc
      .from('profiles')
      .select('id')
      .eq('phone', newPhone)
      .neq('id', user.id)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ error: 'Phone number already in use' }, { status: 409 })
    }

    // Capture old auth email for rollback
    const { data: { user: authUser } } = await svc.auth.admin.getUserById(user.id)
    const oldAuthEmail = authUser?.email ?? null

    // Update auth email first — login depends on this being correct
    const { error: authErr } = await svc.auth.admin.updateUserById(user.id, {
      email: phoneToEmail(newPhone),
    })
    if (authErr) return serverError(authErr.message)

    // Update profiles — rollback auth email if this fails
    const { error: profileErr } = await svc.from('profiles').update(parsed.data).eq('id', user.id)
    if (profileErr) {
      if (oldAuthEmail) {
        await svc.auth.admin.updateUserById(user.id, { email: oldAuthEmail })
      }
      return serverError(profileErr.message)
    }
  } else {
    const { error } = await svc.from('profiles').update(parsed.data).eq('id', user.id)
    if (error) return serverError(error.message)
  }

  return NextResponse.json({ ok: true })
}