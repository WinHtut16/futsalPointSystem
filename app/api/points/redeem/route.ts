import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { RedeemSchema, badRequest, parseJson, serverError } from '@/lib/schemas'

export async function POST(request: NextRequest) {
  try {
    const customer = await requireRole('customer')

    const parsed = RedeemSchema.safeParse(await parseJson(request))
    if (!parsed.success) return badRequest(parsed.error)
    const { reward_id } = parsed.data

    const supabase = await createServiceClient()

    const { error } = await supabase.rpc('redeem_reward_direct', {
      p_customer_id: customer.id,
      p_reward_id: reward_id,
    })

    if (error) {
      if (error.message === 'reward_unavailable')
        return NextResponse.json({ error: 'Reward not available.' }, { status: 404 })
      if (error.message === 'out_of_stock')
        return NextResponse.json({ error: 'Reward is out of stock.' }, { status: 400 })
      if (error.message === 'insufficient_points')
        return NextResponse.json({ error: 'Not enough points.' }, { status: 400 })
      return serverError(error.message)
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
