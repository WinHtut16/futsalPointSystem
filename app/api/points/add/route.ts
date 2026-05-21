import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAnyAdmin } from '@/lib/auth'
import { calculatePoints } from '@/lib/points'

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAnyAdmin()
    const { customer_id, hours_played, note } = await request.json()

    if (!customer_id || typeof hours_played !== 'number' || hours_played <= 0) {
      return NextResponse.json({ error: 'Invalid input.' }, { status: 400 })
    }

    const supabase = await createServiceClient()

    const { data: customer } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', customer_id)
      .single()

    if (!customer || customer.role !== 'customer') {
      return NextResponse.json({ error: 'Customer not found.' }, { status: 404 })
    }

    const points_added = calculatePoints(hours_played)

    const { error } = await supabase.rpc('add_points_transaction', {
      p_customer_id: customer_id,
      p_points_delta: points_added,
      p_transaction_type: 'earn',
      p_hours_played: hours_played,
      p_reward_id: null,
      p_note: note ?? null,
      p_created_by: admin.id,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data: updated } = await supabase
      .from('profiles')
      .select('total_points')
      .eq('id', customer_id)
      .single()

    return NextResponse.json({ points_added, total_points: updated?.total_points })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
