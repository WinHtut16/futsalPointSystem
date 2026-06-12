import Link from 'next/link'
import { requireAnyAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import ActivityLogList, { type ActivityLogItem } from '@/components/admin/ActivityLogList'
import T from '@/components/ui/T'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20
const ALL_LIMIT = 300

type Tab = 'all' | 'bookings' | 'points' | 'rewards'
const VALID_TABS: Tab[] = ['all', 'bookings', 'points', 'rewards']

function pageRange(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const nums = new Set<number>()
  nums.add(1)
  nums.add(total)
  for (let i = Math.max(1, current - 2); i <= Math.min(total, current + 2); i++) nums.add(i)
  const sorted = [...nums].sort((a, b) => a - b)
  const result: (number | null)[] = []
  let prev = 0
  for (const p of sorted) {
    if (p - prev > 1) result.push(null)
    result.push(p)
    prev = p
  }
  return result
}

function bookingToItem(b: {
  id: string; ref: string | null; status: string; updated_at: string; created_at: string
  guest_name: string | null; customer: { username: string | null } | null
}): ActivityLogItem {
  const status = b.status as 'pending' | 'confirmed' | 'cancelled' | 'closed'
  const type: ActivityLogItem['type'] =
    status === 'confirmed' ? 'booking_confirmed' :
    status === 'cancelled' ? 'booking_cancelled' :
    status === 'closed'    ? 'booking_closed' :
    'booking_pending'
  return {
    id: `b-${b.id}`,
    type,
    name: b.guest_name ?? b.customer?.username ?? 'Guest',
    detail: b.ref ?? undefined,
    timestamp: b.updated_at,
  }
}

function txToItem(tx: {
  id: string; transaction_type: string; points_delta: number
  created_at: string; customer: { username: string | null } | null
}): ActivityLogItem {
  const delta = tx.points_delta
  return {
    id: `t-${tx.id}`,
    type: tx.transaction_type === 'earn' ? 'point_earn' : 'point_adjustment',
    name: tx.customer?.username ?? 'Unknown',
    detail: `${delta > 0 ? '+' : ''}${delta} pts`,
    timestamp: tx.created_at,
  }
}

function redemptionToItem(r: {
  id: string; status: string; requested_at: string
  reward: { name: string } | { name: string }[] | null
  customer: { username: string | null } | null
}): ActivityLogItem {
  const status = r.status as 'pending' | 'approved' | 'rejected' | 'cancelled'
  const type: ActivityLogItem['type'] =
    status === 'approved'  ? 'redemption_approved' :
    status === 'rejected'  ? 'redemption_rejected' :
    status === 'cancelled' ? 'redemption_cancelled' :
    'redemption_pending'
  const rewardName = Array.isArray(r.reward) ? r.reward[0]?.name : (r.reward as { name: string } | null)?.name
  return {
    id: `r-${r.id}`,
    type,
    name: r.customer?.username ?? 'Unknown',
    detail: rewardName ?? undefined,
    timestamp: r.requested_at,
  }
}

export default async function ActivityLogPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>
}) {
  await requireAnyAdmin()
  const supabase = await createClient()

  const params = await searchParams
  const tab: Tab = VALID_TABS.includes(params.tab as Tab) ? (params.tab as Tab) : 'all'
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)
  const offset = (page - 1) * PAGE_SIZE

  let items: ActivityLogItem[] = []
  let total = 0

  if (tab === 'bookings') {
    const [{ count }, { data }] = await Promise.all([
      supabase.from('bookings').select('*', { count: 'exact', head: true }),
      supabase
        .from('bookings')
        .select('id, ref, status, updated_at, created_at, guest_name, customer:profiles!customer_id(username)')
        .order('updated_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1),
    ])
    total = count ?? 0
    items = ((data ?? []) as unknown as Parameters<typeof bookingToItem>[0][]).map(bookingToItem)
  } else if (tab === 'points') {
    const [{ count }, { data }] = await Promise.all([
      supabase
        .from('point_transactions')
        .select('*', { count: 'exact', head: true })
        .in('transaction_type', ['earn', 'adjustment']),
      supabase
        .from('point_transactions')
        .select('id, transaction_type, points_delta, created_at, customer:profiles!customer_id(username)')
        .in('transaction_type', ['earn', 'adjustment'])
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1),
    ])
    total = count ?? 0
    items = ((data ?? []) as unknown as Parameters<typeof txToItem>[0][]).map(txToItem)
  } else if (tab === 'rewards') {
    const [{ count }, { data }] = await Promise.all([
      supabase.from('redemption_requests').select('*', { count: 'exact', head: true }),
      supabase
        .from('redemption_requests')
        .select('id, status, requested_at, reward:rewards(name), customer:profiles!customer_id(username)')
        .order('requested_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1),
    ])
    total = count ?? 0
    items = ((data ?? []) as unknown as Parameters<typeof redemptionToItem>[0][]).map(redemptionToItem)
  } else {
    // 'all' tab: merge recent from each source in memory
    const [{ data: bookings }, { data: txns }, { data: redemptions }] = await Promise.all([
      supabase
        .from('bookings')
        .select('id, ref, status, updated_at, created_at, guest_name, customer:profiles!customer_id(username)')
        .order('updated_at', { ascending: false })
        .limit(ALL_LIMIT),
      supabase
        .from('point_transactions')
        .select('id, transaction_type, points_delta, created_at, customer:profiles!customer_id(username)')
        .in('transaction_type', ['earn', 'adjustment'])
        .order('created_at', { ascending: false })
        .limit(ALL_LIMIT),
      supabase
        .from('redemption_requests')
        .select('id, status, requested_at, reward:rewards(name), customer:profiles!customer_id(username)')
        .order('requested_at', { ascending: false })
        .limit(ALL_LIMIT),
    ])

    const merged: ActivityLogItem[] = [
      ...((bookings ?? []) as unknown as Parameters<typeof bookingToItem>[0][]).map(bookingToItem),
      ...((txns ?? []) as unknown as Parameters<typeof txToItem>[0][]).map(txToItem),
      ...((redemptions ?? []) as unknown as Parameters<typeof redemptionToItem>[0][]).map(redemptionToItem),
    ].sort((a, b) => b.timestamp.localeCompare(a.timestamp))

    total = merged.length
    items = merged.slice(offset, offset + PAGE_SIZE)
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const from = total === 0 ? 0 : offset + 1
  const to = Math.min(offset + PAGE_SIZE, total)

  const tabDefs: { value: Tab; labelKey: 'admin.activityTabAll' | 'admin.activityTabBookings' | 'admin.activityTabPoints' | 'admin.activityTabRewards' }[] = [
    { value: 'all',      labelKey: 'admin.activityTabAll' },
    { value: 'bookings', labelKey: 'admin.activityTabBookings' },
    { value: 'points',   labelKey: 'admin.activityTabPoints' },
    { value: 'rewards',  labelKey: 'admin.activityTabRewards' },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">
          <T k="admin.activityLog" />
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          <T k="admin.activityLogSubtitle" />
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-0.5 px-0.5 scrollbar-hide">
        {tabDefs.map(({ value, labelKey }) => (
          <Link
            key={value}
            href={`/admin/activity?tab=${value}&page=1`}
            className={`rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              tab === value
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <T k={labelKey} />
          </Link>
        ))}
      </div>

      {/* Count */}
      {total > 0 && (
        <p className="text-xs text-gray-400">
          <T k="admin.activityShowingOf" vars={{ from, to, total }} />
        </p>
      )}

      {/* List */}
      <ActivityLogList items={items} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 flex-wrap pt-1">
          {page > 1 ? (
            <Link
              href={`/admin/activity?tab=${tab}&page=${page - 1}`}
              className="flex h-9 items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
            >
              <T k="admin.activityPrev" />
            </Link>
          ) : (
            <span className="flex h-9 items-center gap-1 rounded-xl border border-gray-200 px-3 text-sm font-semibold text-gray-300 cursor-not-allowed">
              <T k="admin.activityPrev" />
            </span>
          )}

          {pageRange(page, totalPages).map((p, i) =>
            p === null ? (
              <span key={`ellipsis-${i}`} className="flex h-9 w-9 items-center justify-center text-sm text-gray-400">
                …
              </span>
            ) : (
              <Link
                key={p}
                href={`/admin/activity?tab=${tab}&page=${p}`}
                className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold transition-colors ${
                  p === page ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {p}
              </Link>
            )
          )}

          {page < totalPages ? (
            <Link
              href={`/admin/activity?tab=${tab}&page=${page + 1}`}
              className="flex h-9 items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
            >
              <T k="admin.activityNext" />
            </Link>
          ) : (
            <span className="flex h-9 items-center gap-1 rounded-xl border border-gray-200 px-3 text-sm font-semibold text-gray-300 cursor-not-allowed">
              <T k="admin.activityNext" />
            </span>
          )}
        </div>
      )}
    </div>
  )
}
