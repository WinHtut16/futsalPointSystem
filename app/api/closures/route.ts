import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAnyAdmin } from '@/lib/auth'
import { ClosureCreateSchema, badRequest, parseJson } from '@/lib/schemas'

export async function POST(request: NextRequest) {
  let admin
  try {
    admin = await requireAnyAdmin()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = ClosureCreateSchema.safeParse(await parseJson(request))
  if (!parsed.success) return badRequest(parsed.error)
  const { closure_date, hour_start, reason } = parsed.data

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('court_closures')
    .insert({
      closure_date,
      hour_start: hour_start ?? null,
      reason: reason ?? null,
      created_by: admin.id,
    })
    .select('id, closure_date, hour_start, reason')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'That date/slot is already closed.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAnyAdmin()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 })

  const supabase = createServiceClient()
  const { error } = await supabase.from('court_closures').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
