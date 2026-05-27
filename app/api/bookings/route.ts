import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { CreateBookingSchema, badRequest, parseJson } from '@/lib/schemas'
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
  const { booking_date, slots } = parsed.data

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

  // Recompute tier + price server-side — never trust client-supplied prices.
  const slotPayload = slots
    .slice()
    .sort((a, b) => a - b)
    .map((hour) => ({
      hour_start: hour,
      tier: tierForHour(booking_date, hour),
      price: priceForHour(booking_date, hour),
    }))

  const { data, error } = await supabase.rpc('create_booking_transaction', {
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
    return NextResponse.json({ error: error.message }, { status: 500 })
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
