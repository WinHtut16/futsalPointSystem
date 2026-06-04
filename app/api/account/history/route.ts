import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { buildBookingFeedItem, buildTxnFeedItem, mergeFeed, type FeedBookingRow, type FeedTxnRow } from '@/lib/account-feed'
import { serverError } from '@/lib/schemas'

const LIMIT = 20

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const filter = (searchParams.get('filter') ?? 'all') as 'all' | 'bookings' | 'points'
  const page = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10))
  const offset = page * LIMIT

  const supabase = await createClient()
  const svc = createServiceClient()

  if (filter === 'bookings') {
    const { data, error } = await svc
      .from('bookings')
      .select('id, ref, status, booking_date, deposit_total, booking_slots(hour_start)')
      .eq('customer_id', user.id)
      .order('booking_date', { ascending: false })
      .range(offset, offset + LIMIT)

    if (error) return serverError(error.message)

    const rows = (data ?? []) as FeedBookingRow[]
    const hasMore = rows.length > LIMIT
    const items = rows.slice(0, LIMIT).map(buildBookingFeedItem)
    return NextResponse.json({ items, hasMore })
  }

  if (filter === 'points') {
    const { data, error } = await supabase
      .from('point_transactions')
      .select('id, created_at, points_delta, transaction_type, hours_played, note, reward:rewards(name)')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + LIMIT)

    if (error) return serverError(error.message)

    const txns = (data ?? []) as unknown as FeedTxnRow[]
    const hasMore = txns.length > LIMIT
    const items = txns.slice(0, LIMIT).map(buildTxnFeedItem)
    return NextResponse.json({ items, hasMore })
  }

  // filter === 'all': fetch enough from both sources, merge, sort, slice
  const needed = offset + LIMIT + 1
  const [bookingsRes, txnsRes] = await Promise.all([
    svc
      .from('bookings')
      .select('id, ref, status, booking_date, deposit_total, booking_slots(hour_start)')
      .eq('customer_id', user.id)
      .order('booking_date', { ascending: false })
      .limit(needed),
    supabase
      .from('point_transactions')
      .select('id, created_at, points_delta, transaction_type, hours_played, note, reward:rewards(name)')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(needed),
  ])

  const bookingItems = ((bookingsRes.data ?? []) as FeedBookingRow[]).map(buildBookingFeedItem)
  const txnItems = ((txnsRes.data ?? []) as unknown as FeedTxnRow[]).map(buildTxnFeedItem)
  const merged = mergeFeed(bookingItems, txnItems)

  const sliced = merged.slice(offset, offset + LIMIT + 1)
  const hasMore = sliced.length > LIMIT
  const items = sliced.slice(0, LIMIT)

  return NextResponse.json({ items, hasMore })
}
