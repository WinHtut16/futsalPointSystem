import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const customer = await requireRole('customer')
    const { reward_id } = await request.json()

    if (!reward_id) {
      return NextResponse.json({ error: 'reward_id required.' }, { status: 400 })
    }

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

    const { error } = await supabase.rpc('add_points_transaction', {
      p_customer_id: customer.id,
      p_points_delta: -reward.points_cost,
      p_transaction_type: 'redeem',
      p_hours_played: null,
      p_reward_id: reward_id,
      p_note: null,
      p_created_by: customer.id,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Decrement stock if finite
    if (reward.stock !== null) {
      await supabase
        .from('rewards')
        .update({ stock: reward.stock - 1 })
        .eq('id', reward_id)
    }

    const { data: updated } = await supabase
      .from('profiles')
      .select('total_points')
      .eq('id', customer.id)
      .single()

    return NextResponse.json({ total_points: updated?.total_points })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
