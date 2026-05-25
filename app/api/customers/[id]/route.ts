import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAnyAdmin } from '@/lib/auth'
import {
  IdParamSchema,
  CustomerPasswordResetSchema,
  CustomerProfileUpdateSchema,
  badRequest,
  parseJson,
} from '@/lib/schemas'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAnyAdmin()

    const idParsed = IdParamSchema.safeParse(await params)
    if (!idParsed.success) return badRequest(idParsed.error)
    const { id } = idParsed.data

    const supabase = await createServiceClient()
    const { data, error } = await supabase
      .from('profiles')
      .select('*, point_transactions(*, reward:rewards(name))')
      .eq('id', id)
      .eq('role', 'customer')
      .single()

    if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAnyAdmin()

    const idParsed = IdParamSchema.safeParse(await params)
    if (!idParsed.success) return badRequest(idParsed.error)
    const { id } = idParsed.data

    const body = await parseJson(request)
    const schema =
      body && typeof body === 'object' && 'password' in (body as Record<string, unknown>)
        ? CustomerPasswordResetSchema
        : CustomerProfileUpdateSchema
    const parsed = schema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error)

    const supabase = await createServiceClient()

    // IDOR guard: only customer accounts may be managed through this endpoint
    const { data: target } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', id)
      .single()
    if (!target || target.role !== 'customer') {
      return NextResponse.json({ error: 'Customer not found.' }, { status: 404 })
    }

    if ('password' in parsed.data) {
      const { error } = await supabase.auth.admin.updateUserById(id, {
        password: parsed.data.password,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(parsed.data)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAnyAdmin()

    const idParsed = IdParamSchema.safeParse(await params)
    if (!idParsed.success) return badRequest(idParsed.error)
    const { id } = idParsed.data

    const supabase = await createServiceClient()

    // IDOR guard: only customer accounts may be deleted through this endpoint
    const { data: target } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', id)
      .single()
    if (!target || target.role !== 'customer') {
      return NextResponse.json({ error: 'Customer not found.' }, { status: 404 })
    }

    const { error } = await supabase.auth.admin.deleteUser(id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
