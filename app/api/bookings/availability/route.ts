import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { serverError } from '@/lib/schemas'

export async function GET(request: NextRequest) {
  const date = new URL(request.url).searchParams.get('date')
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date param required (YYYY-MM-DD).' }, { status: 400 })
  }
  const parsed = new Date(date)
  if (isNaN(parsed.getTime()) || date !== parsed.toISOString().slice(0, 10)) {
    return NextResponse.json({ error: 'Invalid calendar date.' }, { status: 400 })
  }

  try {
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
    const closedHours: number[] = (closuresResult.data ?? [])
      .map((c) => c.hour_start)
      .filter((h): h is number => h != null)

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

    const booked: number[] = []
    const pending: number[] = []
    for (const slot of slotsResult.data ?? []) {
      const status = statusMap.get(slot.booking_id as string)
      if (status === 'confirmed') booked.push(slot.hour_start as number)
      else if (status === 'pending') pending.push(slot.hour_start as number)
    }

    return NextResponse.json({ booked, pending, closedHours, dayClosed })
  } catch {
    return serverError()
  }
}
