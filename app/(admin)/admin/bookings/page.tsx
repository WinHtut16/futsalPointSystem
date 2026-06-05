import { requireAnyAdmin } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import AdminBookingsList, { type AdminBooking } from '@/components/admin/booking/AdminBookingsList'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20

type SearchParams = {
  status?: string
  search?: string
  from?: string
  to?: string
  page?: string
}

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  await requireAnyAdmin()

  const params = await searchParams
  const status =
    params.status && params.status !== 'all' ? (params.status as AdminBooking['status']) : null
  const search = params.search?.trim() || null
  const from = params.from || null
  const to = params.to || null
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const offset = (page - 1) * PAGE_SIZE

  let list: AdminBooking[] = []
  let total = 0
  let stats = { bookingsThisWeek: 0, depositsThisWeek: 0, pendingCount: 0, totalCustomers: 0 }

  const weekAgoISO = (() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return d.toISOString().split('T')[0]
  })()
  const todayISO = new Date().toISOString().split('T')[0]

  try {
    const supabase = createServiceClient()

    // Build customer ID list when searching by name/phone.
    let customerIds: string[] | null = null
    if (search) {
      const { data: customers } = await supabase
        .from('profiles')
        .select('id')
        .or(`username.ilike.%${search}%,phone.ilike.%${search}%`)
      customerIds = (customers ?? []).map((c: { id: string }) => c.id)
    }

    // Stats + booking list queries in parallel.
    const [wbResult, drResult, pcResult, tcResult] = await Promise.all([
      supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .gte('booking_date', weekAgoISO)
        .lte('booking_date', todayISO),
      supabase
        .from('bookings')
        .select('deposit_total')
        .gte('booking_date', weekAgoISO)
        .lte('booking_date', todayISO)
        .eq('deposit_received', true),
      supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'customer'),
    ])

    stats = {
      bookingsThisWeek: wbResult.count ?? 0,
      depositsThisWeek: ((drResult.data ?? []) as { deposit_total: number }[]).reduce(
        (s, r) => s + (r.deposit_total || 0),
        0
      ),
      pendingCount: pcResult.count ?? 0,
      totalCustomers: tcResult.count ?? 0,
    }

    // Attempt query with override_request; fall back if column absent.
    type BookingRow = Record<string, unknown>

    async function runQuery(includeOverride: boolean) {
      const cols = includeOverride
        ? 'id, ref, status, booking_date, deposit_total, deposit_received, override_request, updated_at, customer:profiles(username, phone), booking_slots(hour_start)'
        : 'id, ref, status, booking_date, deposit_total, deposit_received, updated_at, customer:profiles(username, phone), booking_slots(hour_start)'

      let q = supabase
        .from('bookings')
        .select(cols, { count: 'exact' })
        .order('booking_date', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1)

      if (status) q = q.eq('status', status)
      if (from) q = q.gte('booking_date', from)
      if (to) q = q.lte('booking_date', to)

      if (search) {
        const refFilter = `ref.ilike.%${search}%`
        const custFilter =
          customerIds && customerIds.length > 0
            ? `,customer_id.in.(${customerIds.join(',')})`
            : ''
        q = q.or(refFilter + custFilter)
      }

      return q
    }

    let result = await runQuery(true)
    if (result.error) {
      console.error('[AdminBookingsPage] retrying without override_request:', result.error.message)
      result = await runQuery(false)
    }

    if (result.error) {
      console.error('[AdminBookingsPage] query error:', result.error.message)
    }

    total = result.count ?? 0

    const rows = (result.data ?? []) as unknown as BookingRow[]
    list = rows.map((b) => {
      const rawCustomer = b.customer
      const customer = Array.isArray(rawCustomer)
        ? (rawCustomer as BookingRow[])[0]
        : (rawCustomer as BookingRow | null)
      return {
        id: b.id as string,
        ref: b.ref as string,
        status: b.status as AdminBooking['status'],
        booking_date: b.booking_date as string,
        deposit_total: (b.deposit_total as number) ?? 0,
        deposit_received: (b.deposit_received as boolean) ?? false,
        override_request: (b.override_request as boolean) ?? false,
        customer: customer
          ? {
              username: customer.username as string | null,
              phone: customer.phone as string | null,
            }
          : null,
        hours: ((b.booking_slots as { hour_start: number }[]) ?? []).map((s) => s.hour_start),
        updated_at: (b.updated_at as string) ?? new Date(0).toISOString(),
      }
    })
  } catch (err) {
    console.error('[AdminBookingsPage] unexpected error:', err)
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Manage bookings</h1>
      <AdminBookingsList
        initial={list}
        total={total}
        page={page}
        totalPages={totalPages}
        pageSize={PAGE_SIZE}
        currentStatus={status ?? 'all'}
        currentSearch={search ?? ''}
        currentFrom={from ?? ''}
        currentTo={to ?? ''}
        stats={stats}
      />
    </div>
  )
}
