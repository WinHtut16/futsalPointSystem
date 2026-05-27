import { requireAnyAdmin } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import AdminBookingsList, { type AdminBooking } from '@/components/admin/booking/AdminBookingsList'

export const dynamic = 'force-dynamic'

export default async function AdminBookingsPage() {
  await requireAnyAdmin()

  let list: AdminBooking[] = []
  try {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('bookings')
      .select(
        'id, ref, status, booking_date, deposit_total, deposit_received, customer:profiles!customer_id(username, phone), booking_slots(hour_start)'
      )
      .order('booking_date', { ascending: false })
      .limit(200)

    list = (data ?? []).map((b) => {
      const customer = Array.isArray(b.customer) ? b.customer[0] : b.customer
      return {
        id: b.id as string,
        ref: b.ref as string,
        status: b.status as AdminBooking['status'],
        booking_date: b.booking_date as string,
        deposit_total: (b.deposit_total as number) ?? 0,
        deposit_received: (b.deposit_received as boolean) ?? false,
        customer: customer ? { username: customer.username, phone: customer.phone } : null,
        hours: ((b.booking_slots as { hour_start: number }[]) ?? []).map((s) => s.hour_start),
      }
    })
  } catch {
    // Booking tables not migrated yet.
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Manage bookings</h1>
      <AdminBookingsList initial={list} />
    </div>
  )
}
