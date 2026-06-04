import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAnyAdmin } from '@/lib/auth'
import { AdjustPointsSchema, badRequest, parseJson, serverError } from '@/lib/schemas'

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAnyAdmin()

    const parsed = AdjustPointsSchema.safeParse(await parseJson(request))
    if (!parsed.success) return badRequest(parsed.error)
    const { customer_id, points_delta, reason } = parsed.data

    const supabase = await createServiceClient()

    // Verify target is a customer
    const { data: customer } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', customer_id)
      .single()

    if (!customer || customer.role !== 'customer') {
      return NextResponse.json({ error: 'Customer not found.' }, { status: 404 })
    }

    // Balance guard is enforced atomically inside the RPC (FOR UPDATE row-lock).
    // A pre-check SELECT here would be racy under concurrent adjustments.
    const { error } = await supabase.rpc('add_points_transaction', {
      p_customer_id: customer_id,
      p_points_delta: points_delta,
      p_transaction_type: 'adjustment',
      p_hours_played: null,
      p_reward_id: null,
      p_note: reason,
      p_created_by: admin.id,
      p_min_balance: 0,
    })

    if (error?.message?.includes('insufficient_balance')) {
      return NextResponse.json(
        { error: 'Adjustment would drive balance below zero.' },
        { status: 400 }
      )
    }
    if (error) return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })

    const { data: updated } = await supabase
      .from('profiles')
      .select('total_points')
      .eq('id', customer_id)
      .single()

    return NextResponse.json({ points_delta, total_points: updated?.total_points })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
