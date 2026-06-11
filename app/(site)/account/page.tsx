import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { getActiveRewards } from '@/lib/cached-queries'
import { formatDate } from '@/lib/utils'
import { canCancel } from '@/lib/booking'
import { buildBookingFeedItem, buildTxnFeedItem, mergeFeed, type FeedBookingRow, type FeedTxnRow } from '@/lib/account-feed'
import SiteNavbar from '@/components/booking/SiteNavbar'
import BottomNav from '@/components/booking/BottomNav'
import UnifiedAccount from '@/components/customer/account/UnifiedAccount'
import type { DashboardBooking } from '@/components/booking/BookingsDashboard'
import type { BookingStatus } from '@/components/booking/BookingHistoryCard'
import type { FeedItem } from '@/components/customer/account/UnifiedTimeline'

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

const FEED_LIMIT = 20

export default async function AccountPage() {
  const profile = await getCurrentUser()
  if (!profile) redirect('/login?next=/account')

  const supabase = await createClient()
  const svc = createServiceClient()

  const today = todayYangon()

  // Run all queries in parallel.
  // Stats: all txns (lightweight — just points_delta) for earned/redeemed totals.
  // Upcoming: only future pending/confirmed bookings (no limit needed — small set).
  // Feed: first 21 from each source for the paginated history feed.
  const [statsRes, upcomingRes, histBookingsRes, histTxnsRes, rewards, pendingRequests] =
    await Promise.all([
      supabase
        .from('point_transactions')
        .select('points_delta, transaction_type')
        .eq('customer_id', profile.id),

      svc
        .from('bookings')
        .select('id, status, booking_date, deposit_total, ref, booking_slots(hour_start)')
        .eq('customer_id', profile.id)
        .in('status', ['pending', 'confirmed'])
        .gte('booking_date', today)
        .order('booking_date', { ascending: true })
        .then((r) => r, () => ({ data: null, error: null })),

      svc
        .from('bookings')
        .select('id, ref, status, booking_date, deposit_total, booking_slots(hour_start)')
        .eq('customer_id', profile.id)
        .order('booking_date', { ascending: false })
        .limit(FEED_LIMIT + 1)
        .then((r) => r, () => ({ data: null, error: null })),

      supabase
        .from('point_transactions')
        .select('id, created_at, points_delta, transaction_type, hours_played, note, reward:rewards(name)')
        .eq('customer_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(FEED_LIMIT + 1),

      getActiveRewards(),

      supabase
        .from('redemption_requests')
        .select('id, reward_id')
        .eq('customer_id', profile.id)
        .eq('status', 'pending'),
    ])

  // Stats
  let earned = 0
  let redeemed = 0
  for (const tx of statsRes.data ?? []) {
    if (tx.transaction_type === 'earn') earned += tx.points_delta
    else if (tx.transaction_type === 'redeem') redeemed += -tx.points_delta
  }

  const initialPendingMap: Record<string, string> = {}
  pendingRequests.data?.forEach((r) => { initialPendingMap[r.reward_id] = r.id })

  // Upcoming bookings
  let upcoming: DashboardBooking[] = []
  try {
    const rows = (upcomingRes.data ?? []) as FeedBookingRow[]
    upcoming = rows.map((r) => {
      const hours = (r.booking_slots ?? []).map((s) => s.hour_start).sort((a, b) => a - b)
      const timeLabel =
        hours.length > 0 ? `${pad(hours[0])}:00 – ${pad(hours[hours.length - 1] + 1)}:00` : '—'
      const earliest = hours.length > 0 ? hours[0] : 0
      return {
        id: r.id,
        status: r.status as BookingStatus,
        dateLabel: formatDate(r.booking_date),
        timeLabel,
        refCode: r.ref,
        deposit: r.deposit_total ? `${r.deposit_total.toLocaleString('en-US')} MMK` : '—',
        canCancel:
          (r.status === 'confirmed' || r.status === 'pending') &&
          canCancel(r.booking_date, earliest),
      }
    })
  } catch {
    // Booking tables not yet migrated — degrade gracefully.
  }

  // Feed items for history tab
  const histBookings = (histBookingsRes.data ?? []) as FeedBookingRow[]
  const histTxns = (histTxnsRes.data ?? []) as unknown as FeedTxnRow[]

  const bookingFeedItems = histBookings.map(buildBookingFeedItem)
  const txnFeedItems = histTxns.map(buildTxnFeedItem)

  // Per-filter initial pages
  const allMerged: FeedItem[] = mergeFeed(bookingFeedItems, txnFeedItems)

  const initialFeeds = {
    all: allMerged.slice(0, FEED_LIMIT),
    bookings: bookingFeedItems.slice(0, FEED_LIMIT),
    points: txnFeedItems.slice(0, FEED_LIMIT),
  }
  const initialHasMore = {
    all: allMerged.length > FEED_LIMIT,
    bookings: bookingFeedItems.length > FEED_LIMIT,
    points: txnFeedItems.length > FEED_LIMIT,
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNavbar active="account" />
      <div className="mx-auto w-full max-w-2xl flex-1 pb-24 md:pb-8">
        <UnifiedAccount
          name={profile.username ?? 'Member'}
          userId={profile.id}
          initialPoints={profile.total_points}
          initialUpdatedAt={profile.updated_at}
          earned={earned}
          redeemed={redeemed}
          joinedISO={profile.created_at}
          phone={profile.phone}
          upcoming={upcoming}
          rewards={rewards}
          initialPendingMap={initialPendingMap}
          initialFeeds={initialFeeds}
          initialHasMore={initialHasMore}
        />
      </div>
      <BottomNav active="me" />
    </div>
  )
}
