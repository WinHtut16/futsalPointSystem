import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { BookingActionSchema, IdParamSchema, badRequest, parseJson } from '@/lib/schemas'
import { calculatePoints } from '@/lib/points'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const idParse = IdParamSchema.safeParse(await params)
  if (!idParse.success) return badRequest(idParse.error)
  const { id } = idParse.data

  const parsed = BookingActionSchema.safeParse(await parseJson(request))
  if (!parsed.success) return badRequest(parsed.error)
  const { action } = parsed.data

  const supabase = createServiceClient()
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, customer_id, status, deposit_received, points_awarded, override_request, booking_date')
    .eq('id', id)
    .single()

  if (!booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 })

  const isAdmin = user.role === 'admin' || user.role === 'superadmin'

  if (action === 'cancel') {
    // Customer may cancel their own booking; admins may cancel any.
    if (booking.customer_id !== user.id && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (booking.status !== 'pending' && booking.status !== 'confirmed') {
      return NextResponse.json({ error: 'This booking can no longer be cancelled.' }, { status: 409 })
    }
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ status: 'cancelled' })
  }

  // Remaining actions are admin-only.
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (action === 'confirm') {
    if (booking.status === 'cancelled' || booking.status === 'closed') {
      return NextResponse.json({ error: 'Cannot confirm a cancelled or closed booking.' }, { status: 409 })
    }

    // If this is an override booking: cancel conflicting pending bookings FIRST,
    // so their slots become active=false before we set this booking to confirmed
    // (which triggers the sync trigger to set our slots active=true).
    if (booking.override_request) {
      const { data: mySlots } = await supabase
        .from('booking_slots')
        .select('hour_start')
        .eq('booking_id', id)

      const hours = (mySlots ?? []).map((s: { hour_start: number }) => s.hour_start)

      if (hours.length > 0) {
        const { data: conflictSlots } = await supabase
          .from('booking_slots')
          .select('booking_id')
          .eq('active', true)
          .in('hour_start', hours)
          .neq('booking_id', id)

        if (conflictSlots && conflictSlots.length > 0) {
          const conflictIds = [
            ...new Set((conflictSlots as { booking_id: string }[]).map((s) => s.booking_id)),
          ]
          const { data: conflictBookings } = await supabase
            .from('bookings')
            .select('id')
            .in('id', conflictIds)
            .eq('booking_date', booking.booking_date)
            .eq('status', 'pending')

          if (conflictBookings && conflictBookings.length > 0) {
            await supabase
              .from('bookings')
              .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
              .in('id', (conflictBookings as { id: string }[]).map((b) => b.id))
          }
        }
      }
    }

    const { error: updErr } = await supabase
      .from('bookings')
      .update({ status: 'confirmed', deposit_received: true, confirmed_at: new Date().toISOString() })
      .eq('id', id)
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

    // Award loyalty points once (10 pts/hr; each slot = 1 hour).
    let pointsAwarded = booking.points_awarded
    if (booking.points_awarded === 0) {
      const { count } = await supabase
        .from('booking_slots')
        .select('id', { count: 'exact', head: true })
        .eq('booking_id', id)
      const hours = count ?? 0
      const points = calculatePoints(hours)
      if (points > 0) {
        const { error: rpcErr } = await supabase.rpc('add_points_transaction', {
          p_customer_id: booking.customer_id,
          p_points_delta: points,
          p_transaction_type: 'booking',
          p_hours_played: hours,
          p_reward_id: null,
          p_note: `Booking ${id}`,
          p_created_by: user.id,
        })
        if (!rpcErr) {
          await supabase.from('bookings').update({ points_awarded: points }).eq('id', id)
          pointsAwarded = points
        }
      }
    }
    return NextResponse.json({ status: 'confirmed', points_awarded: pointsAwarded })
  }

  if (action === 'unconfirm') {
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'pending', deposit_received: false })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ status: 'pending' })
  }

  if (action === 'close') {
    const { error } = await supabase.from('bookings').update({ status: 'closed' }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ status: 'closed' })
  }

  return NextResponse.json({ error: 'Invalid action.' }, { status: 400 })
}
