import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, broadcastSlotChange } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { CreateBookingSchema, badRequest, parseJson, serverError } from '@/lib/schemas'
import { priceForHour, tierForHour, isSlotBookable } from '@/lib/booking'

function todayYangon(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Yangon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export async function POST(request: NextRequest) {
  try {
  const user = await requireRole('customer')

  const parsed = CreateBookingSchema.safeParse(await parseJson(request))
  if (!parsed.success) return badRequest(parsed.error)
  const { booking_date, slots, override_request } = parsed.data

  // Cannot book a past date.
  if (booking_date < todayYangon()) {
    return NextResponse.json({ error: 'Cannot book a past date.' }, { status: 400 })
  }

  const supabase = await createServiceClient()

  // Reject slots that fall on an admin-closed day or closed hour.
  const { data: closures } = await supabase
    .from('court_closures')
    .select('hour_start')
    .eq('closure_date', booking_date)

  if (closures && closures.length > 0) {
    const dayClosed = closures.some((c) => c.hour_start == null)
    const closedHours = new Set(closures.map((c) => c.hour_start).filter((h): h is number => h != null))
    if (dayClosed || slots.some((h) => closedHours.has(h))) {
      return NextResponse.json({ error: 'One or more slots are unavailable.' }, { status: 409 })
    }
  }

  // For override requests: require a PENDING booking holds every requested slot on
  // this date. Rejects free slots (no pending holder = no valid override) and
  // confirmed/closed slots (truly taken). Filters by booking_date to avoid matching
  // active slots on other dates that share the same hour_start.
  if (override_request) {
    // Reject if this customer already has a non-cancelled booking on this date
    // that overlaps any of the requested slots — prevents duplicate override spam
    // via direct API calls.
    const { data: ownBookings } = await supabase
      .from('bookings')
      .select('id, booking_slots(hour_start)')
      .eq('customer_id', user.id)
      .eq('booking_date', booking_date)
      .neq('status', 'cancelled')
      .limit(10)

    if (ownBookings && ownBookings.length > 0) {
      const ownedHours = new Set(
        ownBookings.flatMap((b) =>
          ((b.booking_slots ?? []) as { hour_start: number }[]).map((s) => s.hour_start)
        )
      )
      if (slots.some((h) => ownedHours.has(h))) {
        return NextResponse.json(
          { error: 'You already have a booking or pending request for this slot.' },
          { status: 409 }
        )
      }
    }

    const { data: activeSlots, error: slotsErr } = await supabase
      .from('booking_slots')
      .select('booking_id, hour_start')
      .eq('booking_date', booking_date)
      .eq('active', true)
      .in('hour_start', slots)

    if (slotsErr) return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })

    // Every requested override slot must have an active booking holding it.
    const foundHours = new Set((activeSlots ?? []).map((s) => s.hour_start as number))
    const missingHour = slots.find((h) => !foundHours.has(h))
    if (missingHour !== undefined) {
      return NextResponse.json(
        { error: `No pending booking exists for ${booking_date} at ${missingHour}:00 — override not valid.` },
        { status: 400 }
      )
    }

    const bookingIds = (activeSlots ?? []).map((s) => s.booking_id as string)
    const { data: existingBookings, error: bookingsErr } = await supabase
      .from('bookings')
      .select('id, status')
      .in('id', bookingIds)
      .eq('booking_date', booking_date)

    if (bookingsErr) return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })

    const hasConfirmed = existingBookings?.some(
      (b) => b.status === 'confirmed' || b.status === 'closed'
    )
    if (hasConfirmed) {
      return NextResponse.json(
        { error: 'This slot is already confirmed. Please pick another time.' },
        { status: 409 }
      )
    }
  }

  // Enforce lead time server-side for normal bookings (not overrides — those are
  // admin-directed and the pending slot may be within 1 hour intentionally).
  if (!override_request) {
    for (const slot of slots) {
      if (!isSlotBookable(booking_date, slot)) {
        return NextResponse.json(
          { error: `Slot ${booking_date} at ${slot}:00 is no longer available (too close to start time or in the past).` },
          { status: 400 }
        )
      }
    }
  }

  // Recompute tier + price server-side — never trust client-supplied prices.
  const slotPayload = slots
    .slice()
    .sort((a, b) => a - b)
    .map((hour) => ({
      hour_start: hour,
      tier: tierForHour(booking_date, hour),
      price: priceForHour(booking_date, hour),
    }))

  const rpcName = override_request
    ? 'create_override_booking_transaction'
    : 'create_booking_transaction'

  const { data, error } = await supabase.rpc(rpcName, {
    p_customer_id: user.id,
    p_booking_date: booking_date,
    p_slots: slotPayload,
    p_contact_name: user.username ?? null,
    p_contact_phone: user.phone ?? null,
  })

  if (error) {
    // 23505 = unique_violation → a slot was taken concurrently.
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
    if (error.message?.includes('no_pending_conflict')) {
      return NextResponse.json(
        { error: 'No pending booking exists for this slot.' },
        { status: 400 }
      )
    }
    return serverError(error.message)
  }

  const booking = Array.isArray(data) ? data[0] : data
  await broadcastSlotChange(booking_date)
  return NextResponse.json({
    id: booking?.id,
    ref: booking?.ref,
    status: booking?.status,
    deposit_total: booking?.deposit_total,
    price_total: booking?.price_total,
  }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }
}
