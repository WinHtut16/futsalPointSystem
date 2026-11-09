import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { AdjustPointsSchema, badRequest, parseJson, serverError } from '@/lib/schemas'
import { getWalletBalance } from '@/lib/points'
import { isLoyaltyApp } from '@/lib/loyalty'
import { guardResponse, requireLoyaltyRole } from '@/lib/loyalty.server'

/**
 * Manual correction of a customer's game / billiards balance, by any admin of
 * that business, with a mandatory reason - same rules as futsal's
 * /api/points/adjust. Earning normally happens automatically from sessions;
 * this is for mistakes. The balance floor (0) is enforced under lock in the
 * database, and the adjustment is audited under this business.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ app: string }> }) {
  const { app } = await params
  if (!isLoyaltyApp(app)) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

  let admin
  try {
    admin = await requireLoyaltyRole(app, 'admin')
  } catch (e) {
    return guardResponse(e)
  }

  const parsed = AdjustPointsSchema.safeParse(await parseJson(request))
  if (!parsed.success) return badRequest(parsed.error)
  const { customer_id, points_delta, reason } = parsed.data

  const supabase = createServiceClient()
  const { data: customer } = await supabase.from('profiles').select('id, role').eq('id', customer_id).maybeSingle()
  if (!customer || customer.role !== 'customer') {
    return NextResponse.json({ error: 'Customer not found.' }, { status: 404 })
  }

  const { error } = await supabase.rpc('add_points_transaction', {
    p_customer_id: customer_id,
    p_points_delta: points_delta,
    p_transaction_type: 'adjustment',
    p_hours_played: null,
    p_reward_id: null,
    p_note: reason,
    p_created_by: admin.id,
    p_min_balance: 0,
    p_app: app,
  })
  if (error?.message?.includes('insufficient_balance')) {
    return NextResponse.json({ error: 'Adjustment would drive balance below zero.' }, { status: 400 })
  }
  if (error) return serverError(error.message)

  return NextResponse.json({ points_delta, total_points: await getWalletBalance(supabase, customer_id, app) })
}
