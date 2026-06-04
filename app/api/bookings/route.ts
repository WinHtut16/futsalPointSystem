import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { CreateBookingSchema, badRequest, parseJson, serverError } from '@/lib/schemas'
import { priceForHour, tierForHour } from '@/lib/booking'

function todayYangon(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Yangon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = CreateBookingSchema.safeParse(await parseJson(request))
  if (!parsed.success) return badRequest(parsed.error)
  const { booking_date, slots, override_request } = parsed.data

  // Cannot book a past date.
  if (booking_date < todayYangon()) {
    return NextResponse.json({ error: 'Cannot book a past date.' }, { status: 400 })
  }

  const supabase = createServiceClient()

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
    return serverError(error.message)
  }

  const booking = Array.isArray(data) ? data[0] : data
  return NextResponse.json({
    id: booking?.id,
    ref: booking?.ref,
    status: booking?.status,
    deposit_total: booking?.deposit_total,
    price_total: booking?.price_total,
  })
}
