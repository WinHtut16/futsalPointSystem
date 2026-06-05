import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { CustomerProfileUpdateSchema, badRequest, parseJson, serverError } from '@/lib/schemas'
import { normalizePhone } from '@/lib/utils'

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
  const { error } = await svc.from('profiles').update(parsed.data).eq('id', user.id)
  if (error) return serverError(error.message)

  return NextResponse.json({ ok: true })
}