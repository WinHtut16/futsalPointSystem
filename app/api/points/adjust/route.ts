import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAnyAdmin } from '@/lib/auth'
import { AdjustPointsSchema, badRequest, parseJson } from '@/lib/schemas'

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
      .select('id, role, total_points')
      .eq('id', customer_id)
      .single()

    if (!customer || customer.role !== 'customer') {
      return NextResponse.json({ error: 'Customer not found.' }, { status: 404 })
    }

    // Guard: cannot reduce balance below zero
    if (customer.total_points + points_delta < 0) {
      return NextResponse.json(
        {
          error: `Balance cannot go below zero. Current balance: ${customer.total_points} pts.`,
        },
        { status: 400 }
      )
    }

    const { error } = await supabase.rpc('add_points_transaction', {
      p_customer_id: customer_id,
      p_points_delta: points_delta,
      p_transaction_type: 'adjustment',
      p_hours_played: null,
      p_reward_id: null,
      p_note: reason,
      p_created_by: admin.id,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

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
