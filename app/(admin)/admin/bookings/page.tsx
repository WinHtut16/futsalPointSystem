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
    const SELECT_FULL = 'id, ref, status, booking_date, deposit_total, deposit_received, override_request, customer:profiles(username, phone), booking_slots(hour_start)'
    const SELECT_BASE = 'id, ref, status, booking_date, deposit_total, deposit_received, customer:profiles(username, phone), booking_slots(hour_start)'

    let result = await supabase
      .from('bookings')
      .select(SELECT_FULL)
      .order('booking_date', { ascending: false })
      .limit(200)

    if (result.error) {
      console.error('[AdminBookingsPage] full query error (retrying without override_request):', result.error.message)
      result = await supabase
        .from('bookings')
        .select(SELECT_BASE)
        .order('booking_date', { ascending: false })
        .limit(200)
    }

    if (result.error) {
      console.error('[AdminBookingsPage] query error:', result.error.message, result.error.details)
    }

    list = (result.data ?? []).map((b) => {
      const customer = Array.isArray(b.customer) ? b.customer[0] : b.customer
      return {
        id: b.id as string,
        ref: b.ref as string,
        status: b.status as AdminBooking['status'],
        booking_date: b.booking_date as string,
        deposit_total: (b.deposit_total as number) ?? 0,
        deposit_received: (b.deposit_received as boolean) ?? false,
        override_request: ((b as Record<string, unknown>).override_request as boolean) ?? false,
        customer: customer ? { username: customer.username, phone: customer.phone } : null,
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
