import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentUser, requireSuperAdmin } from '@/lib/auth'
import { RewardCreateSchema, badRequest, parseJson, serverError } from '@/lib/schemas'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = await createServiceClient()
    let query = supabase.from('rewards').select('*').order('points_cost')

    if (user.role === 'customer') {
      query = query.eq('is_active', true).eq('is_deleted', false)
    }

    const { data, error } = await query
    if (error) return serverError(error.message)
    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin()

    const parsed = RewardCreateSchema.safeParse(await parseJson(request))
    if (!parsed.success) return badRequest(parsed.error)
    const { name, name_my, description, description_my, points_cost, stock } = parsed.data

    const supabase = await createServiceClient()
    const { data, error } = await supabase
      .from('rewards')
      .insert({
        name,
        name_my: name_my ?? null,
        description: description ?? null,
        description_my: description_my ?? null,
        points_cost,
        stock: stock ?? null,
      })
      .select()
      .single()

    if (error) return serverError(error.message)
    revalidateTag('rewards', 'default')
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }
}
