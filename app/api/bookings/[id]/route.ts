import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { BookingActionSchema, IdParamSchema, badRequest, parseJson, serverError } from '@/lib/schemas'
import { canCancel } from '@/lib/booking'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const idParse = IdParamSchema.safeParse(await params)
  if (!idParse.success) return badRequest(idParse.error)
  const { id } = idParse.data

  const parsed = BookingActionSchema.safeParse(await parseJson(request))
  if (!parsed.success) return badRequest(parsed.error)
  const { action } = parsed.data

  const supabase = await createServiceClient()
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, customer_id, status, deposit_received, override_request, booking_date')
    .eq('id', id)
    .single()

  if (!booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 })

  const isAdmin = user.role === 'admin' || user.role === 'superadmin'

  if (action === 'cancel') {
    // Customer may cancel their own booking; admins may cancel any.
    if ((booking.customer_id === null || booking.customer_id !== user.id) && !isAdmin) {
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 })
    }
    if (booking.status !== 'pending' && booking.status !== 'confirmed') {
      return NextResponse.json({ error: 'This booking can no longer be cancelled.' }, { status: 409 })
    }

    if (!isAdmin) {
      const { data: slots, error: slotsError } = await supabase
        .from('booking_slots')
        .select('hour_start')
        .eq('booking_id', id)
        .order('hour_start', { ascending: true })
        .limit(1)

      if (slotsError || !slots || slots.length === 0) {
        return NextResponse.json({ error: 'Booking slots not found.' }, { status: 404 })
      }

      if (!canCancel(booking.booking_date, slots[0].hour_start)) {
        return NextResponse.json(
          { error: 'Cancellation window has closed. Contact staff to cancel.' },
          { status: 400 }
        )
      }
    }

    const { data: cancelled, error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', id)
      .in('status', ['pending', 'confirmed'])
      .select('id')
    if (error) return serverError(error.message)
    if (!cancelled || cancelled.length === 0) {
      return NextResponse.json(
        { error: 'Booking is no longer pending or confirmed — it may have already been cancelled.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ status: 'cancelled' })
  }

  // Remaining actions are admin-only.
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (action === 'confirm') {
    if (booking.status === 'cancelled' || booking.status === 'closed') {
      return NextResponse.json({ error: 'Cannot confirm a cancelled or closed booking.' }, { status: 409 })
    }

    if (booking.override_request) {
      // Atomic RPC: cancels conflicting pending bookings + confirms override in one transaction.
      // Prevents orphaned state if the server crashes between the two operations.
      const { error: rpcErr } = await supabase.rpc('confirm_override_booking', {
        p_booking_id: id,
        p_admin_id: user.id,
      })
      if (rpcErr?.message === 'booking_not_found') {
        return NextResponse.json({ error: 'Booking not found.' }, { status: 404 })
      }
      if (rpcErr) return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
      return NextResponse.json({ status: 'confirmed' })
    }

    const { data: confirmed, error: updErr } = await supabase
      .from('bookings')
      .update({ status: 'confirmed', deposit_received: true, confirmed_at: new Date().toISOString() })
      .eq('id', id)
      .in('status', ['pending'])
      .select('id')
    if (updErr) return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
    if (!confirmed || confirmed.length === 0) {
      return NextResponse.json(
        { error: 'Booking is no longer pending — it may have been cancelled.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ status: 'confirmed' })
  }

  if (action === 'unconfirm') {
    const { data: unconfirmed, error } = await supabase
      .from('bookings')
      .update({ status: 'pending', deposit_received: false })
      .eq('id', id)
      .eq('status', 'confirmed')
      .select('id')
    if (error) return serverError(error.message)
    if (!unconfirmed || unconfirmed.length === 0) {
      return NextResponse.json(
        { error: 'Booking is not confirmed — cannot unconfirm.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ status: 'pending' })
  }

  if (action === 'close') {
    const { data: closed, error } = await supabase
      .from('bookings')
      .update({ status: 'closed' })
      .eq('id', id)
      .in('status', ['pending', 'confirmed'])
      .select('id')
    if (error) return serverError(error.message)
    if (!closed || closed.length === 0) {
      return NextResponse.json(
        { error: 'Booking cannot be closed in its current state.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ status: 'closed' })
  }

  return NextResponse.json({ error: 'Invalid action.' }, { status: 400 })
}
