import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { IdParamSchema, RedemptionActionSchema, badRequest, parseJson, serverError } from '@/lib/schemas'
import { isLoyaltyApp } from '@/lib/loyalty'
import { guardResponse, requireLoyaltyRole } from '@/lib/loyalty.server'

/**
 * Approve or decline a game / billiards redemption request.
 *
 * The request must belong to the business in the URL - checked before
 * anything else, so a billiards admin cannot approve a game request by
 * guessing its id. approve_redemption then deducts from the reward's own
 * business wallet under lock. Customers cancel through /api/redemptions/[id]
 * as before (that path only lets them cancel their own pending request).
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ app: string; id: string }> }) {
  const { app, id: rawId } = await params
  if (!isLoyaltyApp(app)) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

  const idParsed = IdParamSchema.safeParse({ id: rawId })
  if (!idParsed.success) return badRequest(idParsed.error)
  const id = idParsed.data.id

  let admin
  try {
    admin = await requireLoyaltyRole(app, 'admin')
  } catch (e) {
    return guardResponse(e)
  }

  const parsed = RedemptionActionSchema.safeParse(await parseJson(request))
  if (!parsed.success) return badRequest(parsed.error)
  const { action, notes } = parsed.data
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: owned, error: ownedError } = await supabase
    .from('redemption_requests')
    .select('id')
    .eq('id', id)
    .eq('app', app)
    .maybeSingle()
  if (ownedError) return serverError(ownedError.message)
  if (!owned) return NextResponse.json({ error: 'Request not found.' }, { status: 404 })

  if (action === 'approve') {
    const { error } = await supabase.rpc('approve_redemption', {
      p_request_id: id,
      p_approved_by: admin.id,
      p_notes: notes ?? null,
    })
    if (error) {
      switch (error.message) {
        case 'request_not_found':
          return NextResponse.json({ error: 'Request not found.' }, { status: 404 })
        case 'not_pending':
          return NextResponse.json({ error: 'Only pending requests can be actioned.' }, { status: 409 })
        case 'out_of_stock':
          return NextResponse.json({ error: 'Reward is now out of stock.' }, { status: 409 })
        case 'reward_unavailable':
          return NextResponse.json({ error: 'Reward is no longer available.' }, { status: 400 })
        case 'insufficient_points':
          return NextResponse.json({ error: 'Customer no longer has enough points.' }, { status: 400 })
        default:
          return serverError(error.message)
      }
    }
    revalidateTag('rewards', 'default')
    return NextResponse.json({ success: true })
  }

  const { data: rejected, error: rejectError } = await supabase
    .from('redemption_requests')
    .update({ status: 'rejected', resolved_at: new Date().toISOString(), resolved_by: admin.id, notes: notes ?? null })
    .eq('id', id)
    .eq('app', app)
    .eq('status', 'pending')
    .select('id')
  if (rejectError) return serverError(rejectError.message)
  if (!rejected || rejected.length === 0) {
    return NextResponse.json({ error: 'This request has already been actioned.' }, { status: 409 })
  }
  return NextResponse.json({ success: true })
}
