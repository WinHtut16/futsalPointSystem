import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { action, notes } = await request.json()
    const { id } = await params
    const supabase = await createServiceClient()

    const { data: req } = await supabase
      .from('redemption_requests')
      .select('*, reward:rewards(*)')
      .eq('id', id)
      .single()

    if (!req) return NextResponse.json({ error: 'Request not found.' }, { status: 404 })

    if (req.status !== 'pending') {
      return NextResponse.json({ error: 'Only pending requests can be actioned.' }, { status: 400 })
    }

    if (user.role === 'customer') {
      if (req.customer_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
      }
      if (action !== 'cancel') {
        return NextResponse.json({ error: 'Invalid action.' }, { status: 400 })
      }

      await supabase
        .from('redemption_requests')
        .update({ status: 'cancelled', resolved_at: new Date().toISOString() })
        .eq('id', id)

      return NextResponse.json({ success: true })
    }

    if (user.role === 'admin' || user.role === 'superadmin') {
      if (!['approve', 'reject'].includes(action)) {
        return NextResponse.json({ error: 'Invalid action.' }, { status: 400 })
      }

      if (action === 'approve') {
        const reward = req.reward

        if (reward.stock !== null && reward.stock <= 0) {
          return NextResponse.json({ error: 'Reward is now out of stock.' }, { status: 400 })
        }

        const { data: customer } = await supabase
          .from('profiles')
          .select('total_points')
          .eq('id', req.customer_id)
          .single()

        if (!customer || customer.total_points < reward.points_cost) {
          return NextResponse.json({ error: 'Customer no longer has enough points.' }, { status: 400 })
        }

        const { error: txError } = await supabase.rpc('add_points_transaction', {
          p_customer_id: req.customer_id,
          p_points_delta: -reward.points_cost,
          p_transaction_type: 'redeem',
          p_hours_played: null,
          p_reward_id: req.reward_id,
          p_note: notes ?? null,
          p_created_by: user.id,
        })

        if (txError) return NextResponse.json({ error: txError.message }, { status: 500 })

        if (reward.stock !== null) {
          await supabase
            .from('rewards')
            .update({ stock: reward.stock - 1 })
            .eq('id', req.reward_id)
        }
      }

      await supabase
        .from('redemption_requests')
        .update({
          status: action === 'approve' ? 'approved' : 'rejected',
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
          notes: notes ?? null,
        })
        .eq('id', id)

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
