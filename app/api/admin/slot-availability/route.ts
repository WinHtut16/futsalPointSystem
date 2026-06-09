import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAnyAdmin } from '@/lib/auth'
import { serverError } from '@/lib/schemas'
import { tierForHour, priceForHour, dayHours } from '@/lib/booking'

export async function GET(request: NextRequest) {
  try {
    await requireAnyAdmin()

    const date = new URL(request.url).searchParams.get('date')
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date param required (YYYY-MM-DD).' }, { status: 400 })
    }
    const parsed = new Date(date)
    if (isNaN(parsed.getTime()) || date !== parsed.toISOString().slice(0, 10)) {
      return NextResponse.json({ error: 'Invalid calendar date.' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const [closuresResult, slotsResult] = await Promise.all([
      supabase.from('court_closures').select('hour_start').eq('closure_date', date),
      supabase
        .from('booking_slots')
        .select('hour_start, booking_id')
        .eq('booking_date', date)
        .eq('active', true),
    ])

    if (closuresResult.error) return serverError(closuresResult.error.message)
    if (slotsResult.error) return serverError(slotsResult.error.message)

    const dayClosed = (closuresResult.data ?? []).some((c) => c.hour_start == null)
    const closedHours = new Set(
      (closuresResult.data ?? [])
        .map((c) => c.hour_start)
        .filter((h): h is number => h != null)
    )

    // Fetch booking statuses for active slots
    const bookingIds = (slotsResult.data ?? []).map((s) => s.booking_id as string)
    const statusMap = new Map<string, string>()
    if (bookingIds.length > 0) {
      const { data: bookings, error: bookingsErr } = await supabase
        .from('bookings')
        .select('id, status')
        .in('id', bookingIds)
      if (bookingsErr) return serverError(bookingsErr.message)
      for (const b of bookings ?? []) statusMap.set(b.id as string, b.status as string)
    }

    const pendingHours = new Set<number>()
    const bookedHours = new Set<number>()
    for (const slot of slotsResult.data ?? []) {
      const status = statusMap.get(slot.booking_id as string)
      if (status === 'pending') pendingHours.add(slot.hour_start as number)
      else if (status === 'confirmed') bookedHours.add(slot.hour_start as number)
    }

    const slots = dayHours().map((hour) => {
      let state: 'available' | 'pending' | 'booked' | 'closed'
      if (dayClosed || closedHours.has(hour)) state = 'closed'
      else if (bookedHours.has(hour)) state = 'booked'
      else if (pendingHours.has(hour)) state = 'pending'
      else state = 'available'
      return { hour, state, tier: tierForHour(date, hour), price: priceForHour(date, hour) }
    })

    return NextResponse.json({ slots })
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }
}
