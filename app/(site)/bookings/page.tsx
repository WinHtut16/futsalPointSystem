import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { formatDate } from '@/lib/utils'
import { canCancel } from '@/lib/booking'
import SiteNavbar from '@/components/booking/SiteNavbar'
import BottomNav from '@/components/booking/BottomNav'
import BookingsDashboard, { type DashboardBooking } from '@/components/booking/BookingsDashboard'
import type { BookingStatus } from '@/components/booking/BookingHistoryCard'

export const dynamic = 'force-dynamic'

const pad = (n: number) => String(n).padStart(2, '0')

function todayYangon(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Yangon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

type Row = {
  id: string
  status: BookingStatus
  booking_date: string
  deposit_total: number
  ref: string
}

export default async function BookingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/bookings')

  let upcoming: DashboardBooking[] = []
  let history: DashboardBooking[] = []

  try {
    const supabase = createServiceClient()
    const { data: bookings } = await supabase
      .from('bookings')
      .select('id, status, booking_date, deposit_total, ref')
      .eq('customer_id', user.id)
      .order('booking_date', { ascending: false })

    const rows = (bookings ?? []) as Row[]
    const ids = rows.map((r) => r.id)

    const hoursByBooking: Record<string, number[]> = {}
    if (ids.length > 0) {
      const { data: slots } = await supabase
        .from('booking_slots')
        .select('booking_id, hour_start')
        .in('booking_id', ids)
      for (const s of slots ?? []) {
        ;(hoursByBooking[s.booking_id as string] ??= []).push(s.hour_start as number)
      }
    }

    const today = todayYangon()

    const toDash = (r: Row): DashboardBooking => {
      const hours = (hoursByBooking[r.id] ?? []).sort((a, b) => a - b)
      const timeLabel =
        hours.length > 0
          ? `${pad(hours[0])}:00 – ${pad(hours[hours.length - 1] + 1)}:00`
          : '—'
      const earliest = hours.length > 0 ? hours[0] : 0
      const cancellable =
        (r.status === 'confirmed' || r.status === 'pending') && canCancel(r.booking_date, earliest)
      return {
        id: r.id,
        status: r.status,
        dateLabel: formatDate(r.booking_date),
        timeLabel,
        refCode: r.ref,
        deposit: r.deposit_total ? `${r.deposit_total.toLocaleString('en-US')} MMK` : '—',
        canCancel: cancellable,
      }
    }

    for (const r of rows) {
      const isUpcoming = (r.status === 'pending' || r.status === 'confirmed') && r.booking_date >= today
      if (isUpcoming) upcoming.push(toDash(r))
      else history.push(toDash(r))
    }
    // upcoming sorted soonest-first
    upcoming = upcoming.sort((a, b) => a.dateLabel.localeCompare(b.dateLabel))
  } catch {
    // Booking tables not migrated yet in this environment.
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNavbar active="dashboard" mobileTitle={undefined} />
      <div className="mx-auto w-full max-w-2xl flex-1 pb-6 md:px-0 md:py-6">
        <BookingsDashboard
          name={user.username ?? 'Member'}
          points={user.total_points ?? 0}
          upcoming={upcoming}
          history={history}
        />
      </div>
      <BottomNav active="me" />
    </div>
  )
}
