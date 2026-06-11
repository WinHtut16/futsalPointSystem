import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { buildBookingFeedItem, buildTxnFeedItem, mergeFeed, type FeedBookingRow, type FeedTxnRow } from '@/lib/account-feed'
import { serverError } from '@/lib/schemas'

const LIMIT = 20
const MYANMAR_OFFSET_MS = (6 * 60 + 30) * 60 * 1000
const GRACE_MS = 2 * 60 * 60 * 1000

function slotEndUTCMs(dateISO: string, lastHour: number): number {
  const [y, m, d] = dateISO.split('-').map(Number)
  return Date.UTC(y, m - 1, d, lastHour + 1, 0, 0) - MYANMAR_OFFSET_MS
}

function isHistoryEligible(r: FeedBookingRow): boolean {
  if (r.status === 'cancelled') return true
  const hours = (r.booking_slots ?? []).map(s => s.hour_start)
  const lastHour = hours.length > 0 ? Math.max(...hours) : 23
  return slotEndUTCMs(r.booking_date, lastHour) + GRACE_MS <= Date.now()
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const filter = (searchParams.get('filter') ?? 'all') as 'all' | 'bookings' | 'points'
  const before = searchParams.get('before') ?? null  // ISO string cursor; null = first page

  const supabase = await createClient()
  const svc = await createServiceClient()

  if (filter === 'bookings') {
    let query = svc
      .from('bookings')
      .select('id, ref, status, booking_date, deposit_total, booking_slots(hour_start)')
      .eq('customer_id', user.id)
      .order('booking_date', { ascending: false })
      .limit(LIMIT + 1)

    if (before) {
      query = query.lt('booking_date', before)
    }

    const { data, error } = await query
    if (error) return serverError(error.message)

    const rows = (data ?? []) as FeedBookingRow[]
    const eligible = rows.filter(isHistoryEligible)
    const hasMore = eligible.length > LIMIT
    const items = eligible.slice(0, LIMIT).map(buildBookingFeedItem)
    const nextCursor = hasMore ? items[items.length - 1].ts : null
    return NextResponse.json({ items, hasMore, nextCursor })
  }

  if (filter === 'points') {
    let query = supabase
      .from('point_transactions')
      .select('id, created_at, points_delta, transaction_type, hours_played, note, reward:rewards(name)')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(LIMIT + 1)

    if (before) {
      query = query.lt('created_at', before)
    }

    const { data, error } = await query
    if (error) return serverError(error.message)

    const txns = (data ?? []) as unknown as FeedTxnRow[]
    const hasMore = txns.length > LIMIT
    const items = txns.slice(0, LIMIT).map(buildTxnFeedItem)
    const nextCursor = hasMore ? items[items.length - 1].ts : null
    return NextResponse.json({ items, hasMore, nextCursor })
  }

  // filter === 'all': fetch LIMIT+1 from each source using their cursor columns, merge, sort, slice
  const [bookingsRes, txnsRes] = await Promise.all([
    (() => {
      let q = svc
        .from('bookings')
        .select('id, ref, status, booking_date, deposit_total, booking_slots(hour_start)')
        .eq('customer_id', user.id)
        .order('booking_date', { ascending: false })
        .limit(LIMIT + 1)
      if (before) q = q.lt('booking_date', before)
      return q
    })(),
    (() => {
      let q = supabase
        .from('point_transactions')
        .select('id, created_at, points_delta, transaction_type, hours_played, note, reward:rewards(name)')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(LIMIT + 1)
      if (before) q = q.lt('created_at', before)
      return q
    })(),
  ])

  const bookingItems = ((bookingsRes.data ?? []) as FeedBookingRow[])
    .filter(isHistoryEligible)
    .map(buildBookingFeedItem)
  const txnItems = ((txnsRes.data ?? []) as unknown as FeedTxnRow[]).map(buildTxnFeedItem)
  const merged = mergeFeed(bookingItems, txnItems)

  const sliced = merged.slice(0, LIMIT + 1)
  const hasMore = sliced.length > LIMIT
  const items = sliced.slice(0, LIMIT)
  const nextCursor = hasMore ? items[items.length - 1].ts : null

  return NextResponse.json({ items, hasMore, nextCursor })
}
