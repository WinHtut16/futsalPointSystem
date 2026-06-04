import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentUser, requireRole } from '@/lib/auth'
import { RedeemSchema, badRequest, parseJson, serverError } from '@/lib/schemas'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = await createServiceClient()

    if (user.role === 'admin' || user.role === 'superadmin') {
      const { data, error } = await supabase
        .from('redemption_requests')
        .select('*, reward:rewards(name, points_cost), customer:profiles!customer_id(username, phone, total_points)')
        .eq('status', 'pending')
        .order('requested_at', { ascending: true })

      if (error) return serverError(error.message)
      return NextResponse.json(data)
    }

    const { data, error } = await supabase
      .from('redemption_requests')
      .select('*, reward:rewards(name, points_cost)')
      .eq('customer_id', user.id)
      .order('requested_at', { ascending: false })

    if (error) return serverError(error.message)
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const customer = await requireRole('customer')

    const parsed = RedeemSchema.safeParse(await parseJson(request))
    if (!parsed.success) return badRequest(parsed.error)
    const { reward_id } = parsed.data

    const supabase = await createServiceClient()

    const { data: reward } = await supabase
      .from('rewards')
      .select('*')
      .eq('id', reward_id)
      .single()

    if (!reward || !reward.is_active) {
      return NextResponse.json({ error: 'Reward not available.' }, { status: 404 })
    }

    if (reward.stock !== null && reward.stock <= 0) {
      return NextResponse.json({ error: 'Reward is out of stock.' }, { status: 400 })
    }

    if (customer.total_points < reward.points_cost) {
      return NextResponse.json({ error: 'Not enough points.' }, { status: 400 })
    }

    const { data: existing } = await supabase
      .from('redemption_requests')
      .select('id')
      .eq('customer_id', customer.id)
      .eq('reward_id', reward_id)
      .eq('status', 'pending')
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'You already have a pending request for this reward.' },
        { status: 409 }
      )
    }

    const { data, error } = await supabase
      .from('redemption_requests')
      .insert({ customer_id: customer.id, reward_id, status: 'pending' })
      .select()
      .single()

    if (error) {
      if (error.code === '23505')
        return NextResponse.json(
          { error: 'You already have a pending request for this reward.' },
          { status: 409 }
        )
      return serverError(error.message)
    }

    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
