import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAnyAdmin } from '@/lib/auth'
import { ClosureCreateSchema, badRequest, parseJson, serverError } from '@/lib/schemas'

export async function POST(request: NextRequest) {
  let admin
  try {
    admin = await requireAnyAdmin()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = ClosureCreateSchema.safeParse(await parseJson(request))
  if (!parsed.success) return badRequest(parsed.error)
  const { closure_date, hour_start, reason } = parsed.data

  const supabase = createServiceClient()

  // Check for existing pending/confirmed bookings that would conflict.
  const { data: dateBookings, error: bookingsErr } = await supabase
    .from('bookings')
    .select('id, ref')
    .eq('booking_date', closure_date)
    .in('status', ['pending', 'confirmed'])

  if (bookingsErr) return serverError(bookingsErr.message)

  if (dateBookings && dateBookings.length > 0) {
    if (hour_start !== null && hour_start !== undefined) {
      // Slot-specific closure: check if any of those bookings hold this hour.
      const bookingIds = dateBookings.map((b) => b.id)
      const { data: slotConflicts, error: slotsErr } = await supabase
        .from('booking_slots')
        .select('booking_id')
        .in('booking_id', bookingIds)
        .eq('hour_start', hour_start)
        .eq('active', true)

      if (slotsErr) return serverError(slotsErr.message)

      if (slotConflicts && slotConflicts.length > 0) {
        const conflictIds = new Set(slotConflicts.map((s) => s.booking_id as string))
        const conflictRefs = dateBookings
          .filter((b) => conflictIds.has(b.id))
          .map((b) => b.ref)
        return NextResponse.json(
          { error: 'Existing bookings conflict with this closure.', conflicts: conflictRefs },
          { status: 409 }
        )
      }
    } else {
      // Full-day closure: any booking on this date conflicts.
      return NextResponse.json(
        {
          error: 'Existing bookings conflict with this closure.',
          conflicts: dateBookings.map((b) => b.ref),
        },
        { status: 409 }
      )
    }
  }

  const { data, error } = await supabase
    .from('court_closures')
    .insert({
      closure_date,
      hour_start: hour_start ?? null,
      reason: reason ?? null,
      created_by: admin.id,
    })
    .select('id, closure_date, hour_start, reason')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'That date/slot is already closed.' }, { status: 409 })
    }
    return serverError(error.message)
  }
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAnyAdmin()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 })

  const supabase = createServiceClient()
  const { error } = await supabase.from('court_closures').delete().eq('id', id)
  if (error) return serverError(error.message)
  return NextResponse.json({ ok: true })
}
