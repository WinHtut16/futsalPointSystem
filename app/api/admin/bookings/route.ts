import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAnyAdmin } from '@/lib/auth'
import { AdminCreateBookingSchema, badRequest, parseJson, serverError } from '@/lib/schemas'
import { priceForHour, tierForHour } from '@/lib/booking'

export async function POST(request: NextRequest) {
  try {
    await requireAnyAdmin()

    const parsed = AdminCreateBookingSchema.safeParse(await parseJson(request))
    if (!parsed.success) return badRequest(parsed.error)

    const {
      customer_id,
      guest_name,
      guest_phone,
      booking_date,
      slots,
      deposit_total,
      deposit_received,
      source,
      internal_notes,
    } = parsed.data

    const supabase = createServiceClient()

    // Check court closures — hard block
    const { data: closures } = await supabase
      .from('court_closures')
      .select('hour_start')
      .eq('closure_date', booking_date)

    if (closures && closures.length > 0) {
      const dayClosed = closures.some((c) => c.hour_start == null)
      const closedHours = new Set(
        closures.map((c) => c.hour_start).filter((h): h is number => h != null)
      )
      if (dayClosed || slots.some((h) => closedHours.has(h))) {
        return NextResponse.json({ error: 'One or more slots are unavailable.' }, { status: 409 })
      }
    }

    // Check for confirmed/closed conflicts — hard block
    // Check for pending conflicts — soft (override path)
    const { data: activeSlots, error: slotsErr } = await supabase
      .from('booking_slots')
      .select('hour_start, booking_id')
      .eq('booking_date', booking_date)
      .eq('active', true)
      .in('hour_start', slots)

    if (slotsErr) return serverError(slotsErr.message)

    let hadConflict = false
    if ((activeSlots ?? []).length > 0) {
      const bookingIds = (activeSlots ?? []).map((s) => s.booking_id as string)
      const { data: existingBookings, error: bookingsErr } = await supabase
        .from('bookings')
        .select('id, status')
        .in('id', bookingIds)
        .eq('booking_date', booking_date)

      if (bookingsErr) return serverError(bookingsErr.message)

      const hasConfirmed = (existingBookings ?? []).some(
        (b) => b.status === 'confirmed' || b.status === 'closed'
      )
      if (hasConfirmed) {
        return NextResponse.json(
          { error: 'Slot already confirmed — pick another time.' },
          { status: 409 }
        )
      }
      hadConflict = true
    }

    // Server-side recompute of tier + price (never trust client-supplied prices)
    const slotPayload = slots
      .slice()
      .sort((a, b) => a - b)
      .map((hour) => ({
        hour_start: hour,
        tier: tierForHour(booking_date, hour),
        price: priceForHour(booking_date, hour),
      }))

    const { data, error } = await supabase.rpc('create_admin_booking_transaction', {
      p_customer_id: customer_id ?? null,
      p_guest_name: guest_name ?? null,
      p_guest_phone: guest_phone ?? null,
      p_booking_date: booking_date,
      p_slots: slotPayload,
      p_deposit_total: deposit_total,
      p_deposit_received: hadConflict ? false : deposit_received,
      p_source: source,
      p_internal_notes: internal_notes ?? null,
      p_is_override: hadConflict,
    })

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'One or more of those slots were just taken. Please pick another time.' },
          { status: 409 }
        )
      }
      if (error.message?.includes('slot_closed')) {
        return NextResponse.json(
          { error: 'This slot has been closed by the court. Please choose another time.' },
          { status: 409 }
        )
      }
      if (error.message?.includes('customer_required')) {
        return NextResponse.json(
          { error: 'Link a customer or enter guest details.' },
          { status: 400 }
        )
      }
      return serverError(error.message)
    }

    const booking = Array.isArray(data) ? data[0] : data
    return NextResponse.json(
      {
        id: booking?.id,
        ref: booking?.ref,
        status: booking?.status,
        deposit_total: booking?.deposit_total,
        price_total: booking?.price_total,
        had_conflict: hadConflict,
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }
}
