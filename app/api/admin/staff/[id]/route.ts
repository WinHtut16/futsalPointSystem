import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth'
import { IdParamSchema, StaffPasswordUpdateSchema, badRequest, parseJson, serverError } from '@/lib/schemas'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin()

    const idParsed = IdParamSchema.safeParse(await params)
    if (!idParsed.success) return badRequest(idParsed.error)
    const { id } = idParsed.data

    const supabase = await createServiceClient()
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, role, created_at')
      .eq('id', id)
      .eq('role', 'admin')
      .single()
    if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const superadmin = await requireSuperAdmin()

    const idParsed = IdParamSchema.safeParse(await params)
    if (!idParsed.success) return badRequest(idParsed.error)
    const { id } = idParsed.data

    if (id === superadmin.id) {
      return NextResponse.json({ error: 'Cannot modify your own account here.' }, { status: 400 })
    }

    const parsed = StaffPasswordUpdateSchema.safeParse(await parseJson(request))
    if (!parsed.success) return badRequest(parsed.error)

    const supabase = await createServiceClient()

    // IDOR guard: only admin accounts may be managed through this endpoint
    const { data: target } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', id)
      .single()
    if (!target || target.role !== 'admin') {
      return NextResponse.json({ error: 'Admin not found.' }, { status: 404 })
    }

    const { error } = await supabase.auth.admin.updateUserById(id, { password: parsed.data.password })
    if (error) return serverError(error.message)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const superadmin = await requireSuperAdmin()

    const idParsed = IdParamSchema.safeParse(await params)
    if (!idParsed.success) return badRequest(idParsed.error)
    const { id } = idParsed.data

    if (id === superadmin.id) {
      return NextResponse.json({ error: 'Cannot delete your own account.' }, { status: 400 })
    }

    const supabase = await createServiceClient()
    const { data: target } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', id)
      .single()

    if (!target || target.role !== 'admin') {
      return NextResponse.json({ error: 'Admin not found.' }, { status: 404 })
    }

    const { error } = await supabase.auth.admin.deleteUser(id)
    if (error) return serverError(error.message)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }
}
