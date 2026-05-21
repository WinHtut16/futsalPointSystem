import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin()
    const { id } = await params
    const supabase = await createServiceClient()
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, role, created_at')
      .eq('id', id)
      .eq('role', 'admin')
      .single()
    if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const superadmin = await requireSuperAdmin()
    const { id } = await params

    if (id === superadmin.id) {
      return NextResponse.json({ error: 'Cannot modify your own account here.' }, { status: 400 })
    }

    const body = await request.json()
    if (!body.password) {
      return NextResponse.json({ error: 'No valid operation.' }, { status: 400 })
    }
    if (typeof body.password !== 'string' || body.password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
    }

    const supabase = await createServiceClient()
    const { error } = await supabase.auth.admin.updateUserById(id, { password: body.password })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const superadmin = await requireSuperAdmin()
    const { id } = await params

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
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
