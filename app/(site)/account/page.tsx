import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { getActiveRewards } from '@/lib/cached-queries'
import { formatDate } from '@/lib/utils'
import { canCancel } from '@/lib/booking'
import SiteNavbar from '@/components/booking/SiteNavbar'
import UnifiedAccount from '@/components/customer/account/UnifiedAccount'
import type { DashboardBooking } from '@/components/booking/BookingsDashboard'
import type { BookingStatus } from '@/components/booking/BookingHistoryCard'
import type { FeedItem } from '@/components/customer/account/UnifiedTimeline'
import type { PointTransaction } from '@/types'

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

type BookingRow = {
  id: string
  status: BookingStatus
  booking_date: string
  deposit_total: number
  ref: string
  booking_slots: { hour_start: number }[]
}

export default async function AccountPage() {
  const profile = await getCurrentUser()
  if (!profile) redirect('/login?next=/account')

  const supabase = await createClient()
  const svc = createServiceClient()

  // All queries in parallel: txns, rewards, pending redemptions, bookings+slots in one join.
  // Bookings query uses a relational join so slot hours are embedded — no second round trip.
  const [{ data: txns }, rewards, { data: pendingRequests }, bookingsRes] = await Promise.all([
    supabase
      .from('point_transactions')
      .select('*, reward:rewards(name)')
      .eq('customer_id', profile.id)
      .order('created_at', { ascending: false }),
    getActiveRewards(),
    supabase
      .from('redemption_requests')
      .select('id, reward_id')
      .eq('customer_id', profile.id)
      .eq('status', 'pending'),
    svc
      .from('bookings')
      .select('id, status, booking_date, deposit_total, ref, booking_slots(hour_start)')
      .eq('customer_id', profile.id)
      .order('booking_date', { ascending: false })
      .then((r) => r, () => ({ data: null, error: null })),
  ])

  const transactions = (txns ?? []) as PointTransaction[]

  let earned = 0
  let redeemed = 0
  for (const tx of transactions) {
    if (tx.points_delta >= 0) earned += tx.points_delta
    else redeemed += -tx.points_delta
  }

  const initialPendingMap: Record<string, string> = {}
  pendingRequests?.forEach((r) => { initialPendingMap[r.reward_id] = r.id })

  let upcoming: DashboardBooking[] = []
  const bookingFeed: FeedItem[] = []
  try {
    const rows = (bookingsRes.data ?? []) as BookingRow[]

    const today = todayYangon()
    for (const r of rows) {
      const hours = (r.booking_slots ?? []).map((s) => s.hour_start).sort((a, b) => a - b)
      const timeLabel =
        hours.length > 0 ? `${pad(hours[0])}:00 – ${pad(hours[hours.length - 1] + 1)}:00` : '—'
      const earliest = hours.length > 0 ? hours[0] : 0
      const cancellable =
        (r.status === 'confirmed' || r.status === 'pending') && canCancel(r.booking_date, earliest)
      const depositLabel = r.deposit_total
        ? `${r.deposit_total.toLocaleString('en-US')} MMK`
        : '—'

      if ((r.status === 'pending' || r.status === 'confirmed') && r.booking_date >= today) {
        upcoming.push({
          id: r.id,
          status: r.status,
          dateLabel: formatDate(r.booking_date),
          timeLabel,
          refCode: r.ref,
          deposit: depositLabel,
          canCancel: cancellable,
        })
      }
      bookingFeed.push({
        kind: 'booking',
        ts: r.booking_date,
        status: r.status,
        timeLabel,
        dateLabel: formatDate(r.booking_date),
        meta: r.ref,
      })
    }
    upcoming = upcoming.sort((a, b) => a.dateLabel.localeCompare(b.dateLabel))
  } catch {
    // Booking tables not migrated in this environment — degrade gracefully.
  }

  const txnFeed: FeedItem[] = transactions.map((tx): FeedItem => {
    const kind: 'earn' | 'redeem' | 'adjust' =
      tx.transaction_type === 'earn'
        ? 'earn'
        : tx.transaction_type === 'redeem'
          ? 'redeem'
          : 'adjust'
    const detail =
      kind === 'redeem'
        ? (tx.reward?.name ?? '')
        : kind === 'earn'
          ? tx.hours_played
            ? `${tx.hours_played}h`
            : ''
          : (tx.note ?? '')
    return {
      kind,
      ts: tx.created_at,
      dateLabel: formatDate(tx.created_at),
      delta: tx.points_delta,
      detail,
    }
  })

  const feed: FeedItem[] = [...bookingFeed, ...txnFeed].sort(
    (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()
  )

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNavbar active="account" />
      <div className="mx-auto w-full max-w-2xl flex-1 pb-8">
        <UnifiedAccount
          name={profile.username ?? 'Member'}
          userId={profile.id}
          initialPoints={profile.total_points}
          earned={earned}
          redeemed={redeemed}
          joinedISO={profile.created_at}
          phone={profile.phone}
          upcoming={upcoming}
          rewards={rewards}
          userPoints={profile.total_points}
          initialPendingMap={initialPendingMap}
          feed={feed}
        />
      </div>
    </div>
  )
}
