import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentUser, requireSuperAdmin } from '@/lib/auth'
import { RewardCreateSchema, badRequest, parseJson } from '@/lib/schemas'

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
    await requireSuperAdmin()

    const parsed = RewardCreateSchema.safeParse(await parseJson(request))
    if (!parsed.success) return badRequest(parsed.error)
    const { name, description, points_cost, stock } = parsed.data

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
