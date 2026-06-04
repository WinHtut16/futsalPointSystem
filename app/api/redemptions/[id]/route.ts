import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { IdParamSchema, RedemptionActionSchema, badRequest, parseJson, serverError } from '@/lib/schemas'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const idParsed = IdParamSchema.safeParse(await params)
    if (!idParsed.success) return badRequest(idParsed.error)
    const { id } = idParsed.data

    const bodyParsed = RedemptionActionSchema.safeParse(await parseJson(request))
    if (!bodyParsed.success) return badRequest(bodyParsed.error)
    const { action, notes } = bodyParsed.data

    const supabase = await createServiceClient()

    if (user.role === 'customer') {
      if (action !== 'cancel')
        return NextResponse.json({ error: 'Invalid action.' }, { status: 400 })

      const { data: req } = await supabase
        .from('redemption_requests')
        .select('customer_id, status')
        .eq('id', id)
        .single()

      if (!req) return NextResponse.json({ error: 'Request not found.' }, { status: 404 })
      if (req.status !== 'pending')
        return NextResponse.json({ error: 'Only pending requests can be actioned.' }, { status: 400 })
      if (req.customer_id !== user.id)
        return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

      const { data: cancelled, error: cancelError } = await supabase
        .from('redemption_requests')
        .update({ status: 'cancelled', resolved_at: new Date().toISOString() })
        .eq('id', id)
        .eq('status', 'pending')  // guard: only cancel if still pending (TOCTOU fix)
        .select('id')

      if (cancelError) return serverError(cancelError.message)

      if (!cancelled || cancelled.length === 0) {
        return NextResponse.json(
          { error: 'This request has already been actioned and cannot be cancelled.' },
          { status: 409 }
        )
      }

      return NextResponse.json({ success: true })
    }

    if (user.role === 'admin' || user.role === 'superadmin') {
      if (action !== 'approve' && action !== 'reject')
        return NextResponse.json({ error: 'Invalid action.' }, { status: 400 })

      if (action === 'approve') {
        const { error: rpcError } = await supabase.rpc('approve_redemption', {
          p_request_id: id,
          p_approved_by: user.id,
          p_notes: notes ?? null,
        })

        if (rpcError) {
          if (rpcError.message === 'request_not_found')
            return NextResponse.json({ error: 'Request not found.' }, { status: 404 })
          if (rpcError.message === 'not_pending')
            return NextResponse.json({ error: 'Only pending requests can be actioned.' }, { status: 400 })
          if (rpcError.message === 'out_of_stock')
            return NextResponse.json({ error: 'Reward is now out of stock.' }, { status: 400 })
          if (rpcError.message === 'insufficient_points')
            return NextResponse.json({ error: 'Customer no longer has enough points.' }, { status: 400 })
          return serverError(rpcError.message)
        }

        return NextResponse.json({ success: true })
      }

      // action === 'reject'
      const { data: req } = await supabase
        .from('redemption_requests')
        .select('status')
        .eq('id', id)
        .single()

      if (!req) return NextResponse.json({ error: 'Request not found.' }, { status: 404 })
      if (req.status !== 'pending')
        return NextResponse.json({ error: 'Only pending requests can be actioned.' }, { status: 400 })

      await supabase
        .from('redemption_requests')
        .update({
          status: 'rejected',
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
