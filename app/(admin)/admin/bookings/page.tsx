import { requireAnyAdmin } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import AdminBookingsList, { type AdminBooking } from '@/components/admin/booking/AdminBookingsList'

export const dynamic = 'force-dynamic'

export default async function AdminBookingsPage() {
  await requireAnyAdmin()

  let list: AdminBooking[] = []
  try {
    const supabase = createServiceClient()

    // Try with override_request first (requires pending-override-migration.sql).
    // Fall back to a query without it so the page works even if that migration hasn't run.
    // Use a shared Record type to avoid TypeScript rejecting the fallback assignment.
    type BookingRow = Record<string, unknown>

    const full = await supabase
      .from('bookings')
      .select('id, ref, status, booking_date, deposit_total, deposit_received, override_request, customer:profiles(username, phone), booking_slots(hour_start)')
      .order('booking_date', { ascending: false })
      .limit(200)

    let rows: BookingRow[]
    if (full.error) {
      console.error('[AdminBookingsPage] full query error (retrying without override_request):', full.error.message)
      const base = await supabase
        .from('bookings')
        .select('id, ref, status, booking_date, deposit_total, deposit_received, customer:profiles(username, phone), booking_slots(hour_start)')
        .order('booking_date', { ascending: false })
        .limit(200)
      if (base.error) {
        console.error('[AdminBookingsPage] query error:', base.error.message, base.error.details)
      }
      rows = (base.data ?? []) as BookingRow[]
    } else {
      rows = (full.data ?? []) as BookingRow[]
    }

    list = rows.map((b) => {
      const rawCustomer = b.customer
      const customer = Array.isArray(rawCustomer) ? (rawCustomer as BookingRow[])[0] : rawCustomer as BookingRow | null
      return {
        id: b.id as string,
        ref: b.ref as string,
        status: b.status as AdminBooking['status'],
        booking_date: b.booking_date as string,
        deposit_total: (b.deposit_total as number) ?? 0,
        deposit_received: (b.deposit_received as boolean) ?? false,
        override_request: (b.override_request as boolean) ?? false,
        customer: customer ? { username: customer.username as string | null, phone: customer.phone as string | null } : null,
        hours: ((b.booking_slots as { hour_start: number }[]) ?? []).map((s) => s.hour_start),
      }
    })
  } catch (err) {
    console.error('[AdminBookingsPage] unexpected error:', err)
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Manage bookings</h1>
      <AdminBookingsList initial={list} />
    </div>
  )
}
