import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { CustomerProfileUpdateSchema, badRequest, parseJson, serverError } from '@/lib/schemas'

export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await parseJson(req)
  const parsed = CustomerProfileUpdateSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error)

  const svc = createServiceClient()
  const { error } = await svc.from('profiles').update(parsed.data).eq('id', user.id)
  if (error) return serverError(error.message)

  return NextResponse.json({ ok: true })
}