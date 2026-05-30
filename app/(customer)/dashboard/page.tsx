import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { getActiveRewards } from '@/lib/cached-queries'
import { redirect } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import { canCancel } from '@/lib/booking'
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

type BookingRow = { id: string; status: BookingStatus; booking_date: string; deposit_total: number; ref: string }

export default async function DashboardPage() {
  const profile = await getCurrentUser()
  if (!profile) redirect('/login')

  const supabase = await createClient()

  // ---- parallel fetch: points txns, rewards + pending map ----
  const [{ data: txns }, rewards, { data: pendingRequests }] = await Promise.all([
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
  ])

  const transactions = (txns ?? []) as PointTransaction[]

  // lifetime earned / redeemed (flat — no tiers)
  let earned = 0
  let redeemed = 0
  for (const tx of transactions) {
    if (tx.points_delta >= 0) earned += tx.points_delta
    else redeemed += -tx.points_delta
  }

  const initialPendingMap: Record<string, string> = {}
  pendingRequests?.forEach((r) => { initialPendingMap[r.reward_id] = r.id })

  // ---- bookings (service client — same as /bookings page) ----
  let upcoming: DashboardBooking[] = []
  const bookingFeed: FeedItem[] = []
  try {
    const svc = createServiceClient()
    const { data: bookings } = await svc
      .from('bookings')
      .select('id, status, booking_date, deposit_total, ref')
      .eq('customer_id', profile.id)
      .order('booking_date', { ascending: false })

    const rows = (bookings ?? []) as BookingRow[]
    const ids = rows.map((r) => r.id)
    const hoursByBooking: Record<string, number[]> = {}
    if (ids.length > 0) {
      const { data: slots } = await svc
        .from('booking_slots')
        .select('booking_id, hour_start')
        .in('booking_id', ids)
      for (const s of slots ?? []) {
        ;(hoursByBooking[s.booking_id as string] ??= []).push(s.hour_start as number)
      }
    }

    const today = todayYangon()
    for (const r of rows) {
      const hours = (hoursByBooking[r.id] ?? []).sort((a, b) => a - b)
      const timeLabel = hours.length > 0 ? `${pad(hours[0])}:00 – ${pad(hours[hours.length - 1] + 1)}:00` : '—'
      const earliest = hours.length > 0 ? hours[0] : 0
      const cancellable = (r.status === 'confirmed' || r.status === 'pending') && canCancel(r.booking_date, earliest)
      const depositLabel = r.deposit_total ? `${r.deposit_total.toLocaleString('en-US')} MMK` : '—'

      if ((r.status === 'pending' || r.status === 'confirmed') && r.booking_date >= today) {
        upcoming.push({
          id: r.id, status: r.status, dateLabel: formatDate(r.booking_date), timeLabel,
          refCode: r.ref, deposit: depositLabel, canCancel: cancellable,
        })
      }
      // every booking is a history feed event (booking_date as timestamp)
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

  // ---- points txns → feed items ----
  const txnFeed: FeedItem[] = transactions.map((tx): FeedItem => {
    const kind: 'earn' | 'redeem' | 'adjust' =
      tx.transaction_type === 'earn' ? 'earn' : tx.transaction_type === 'redeem' ? 'redeem' : 'adjust'
    const detail =
      kind === 'redeem' ? (tx.reward?.name ?? '')
        : kind === 'earn' ? (tx.hours_played ? `${tx.hours_played}h` : '')
          : (tx.note ?? '')
    return { kind, ts: tx.created_at, dateLabel: formatDate(tx.created_at), delta: tx.points_delta, detail }
  })

  // merged chronological feed, newest first
  const feed: FeedItem[] = [...bookingFeed, ...txnFeed].sort(
    (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()
  )

  return (
    <UnifiedAccount
      name={profile.username ?? 'Member'}
      userId={profile.id}
      initialPoints={profile.total_points}
      earned={earned}
      redeemed={redeemed}
      joinedISO={profile.created_at}
      upcoming={upcoming}
      rewards={rewards}
      userPoints={profile.total_points}
      initialPendingMap={initialPendingMap}
      feed={feed}
    />
  )
}
