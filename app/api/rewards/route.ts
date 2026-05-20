import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentUser, requireRole } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = await createServiceClient()
    let query = supabase.from('rewards').select('*').order('points_cost')

    if (user.role === 'customer') {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole('admin')
    const { name, description, points_cost, stock } = await request.json()

    if (!name || typeof points_cost !== 'number' || points_cost <= 0) {
      return NextResponse.json({ error: 'Name and positive points_cost required.' }, { status: 400 })
    }

    const supabase = await createServiceClient()
    const { data, error } = await supabase
      .from('rewards')
      .insert({ name, description: description ?? null, points_cost, stock: stock ?? null })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
