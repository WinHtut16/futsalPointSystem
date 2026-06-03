import { formatDate } from '@/lib/utils'
import type { FeedItem } from '@/components/customer/account/UnifiedTimeline'
import type { BookingStatus } from '@/components/booking/BookingHistoryCard'

const pad = (n: number) => String(n).padStart(2, '0')

export type FeedBookingRow = {
  id: string
  status: BookingStatus
  booking_date: string
  deposit_total: number
  ref: string
  booking_slots: { hour_start: number }[]
}

export type FeedTxnRow = {
  id: string
  created_at: string
  points_delta: number
  transaction_type: string
  hours_played?: number | null
  note?: string | null
  // Supabase returns the joined reward as an array (one element or empty)
  reward?: { name: string }[] | { name: string } | null
}

export function buildBookingFeedItem(r: FeedBookingRow): FeedItem {
  const hours = (r.booking_slots ?? []).map((s) => s.hour_start).sort((a, b) => a - b)
  const timeLabel =
    hours.length > 0 ? `${pad(hours[0])}:00 – ${pad(hours[hours.length - 1] + 1)}:00` : '—'
  return {
    kind: 'booking',
    ts: r.booking_date,
    status: r.status,
    timeLabel,
    dateLabel: formatDate(r.booking_date),
    meta: r.ref,
  }
}

function rewardName(reward: FeedTxnRow['reward']): string {
  if (!reward) return ''
  if (Array.isArray(reward)) return reward[0]?.name ?? ''
  return reward.name ?? ''
}

export function buildTxnFeedItem(tx: FeedTxnRow): FeedItem {
  const kind: 'earn' | 'redeem' | 'adjust' =
    tx.transaction_type === 'earn'
      ? 'earn'
      : tx.transaction_type === 'redeem'
        ? 'redeem'
        : 'adjust'
  const detail =
    kind === 'redeem'
      ? rewardName(tx.reward)
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
}

export function mergeFeed(bookingItems: FeedItem[], txnItems: FeedItem[]): FeedItem[] {
  return [...bookingItems, ...txnItems].sort(
    (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()
  )
}
