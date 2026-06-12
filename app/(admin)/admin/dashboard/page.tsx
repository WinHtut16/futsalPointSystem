import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import T from '@/components/ui/T'
import DashboardPeriodSection from '@/components/admin/analytics/DashboardPeriodSection'
import EarningRuleCard from '@/components/admin/EarningRuleCard'
import SectionDivider from '@/components/admin/analytics/SectionDivider'
import BookingKpiCards from '@/components/admin/analytics/BookingKpiCards'
import BookingChartsRow from '@/components/admin/analytics/BookingChartsRow'
import TopCustomersWithProgress from '@/components/admin/analytics/TopCustomersWithProgress'
import RecentActivityFeed from '@/components/admin/analytics/RecentActivityFeed'
import type { DailyPoint } from '@/components/admin/analytics/PointsBarChart'
import type { StatusEntry } from '@/components/admin/analytics/StatusDonut'
import type { CustomerEntry } from '@/components/admin/analytics/TopCustomersBar'
import type { BookingKpiData } from '@/components/admin/analytics/BookingKpiCards'
import type { CourtUtilDay, PeakHourBlock } from '@/components/admin/analytics/BookingChartsRow'
import type { ActivityFeedItem } from '@/components/admin/analytics/RecentActivityFeed'
import { POINTS_PER_HOUR } from '@/lib/points'

/** Myanmar UTC+6:30 date as YYYY-MM-DD, offset by `days` days. */
function yangonDate(offsetDays = 0): string {
  const ms = Date.now() + 6.5 * 3_600_000 + offsetDays * 86_400_000
  return new Date(ms).toISOString().slice(0, 10)
}

/** Day-of-week abbreviation from YYYY-MM-DD. */
function dayLabel(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en', { weekday: 'short' })
}

const HOUR_BLOCKS = [
  { label: '06–10', min: 6, max: 9 },
  { label: '10–14', min: 10, max: 13 },
  { label: '14–18', min: 14, max: 17 },
  { label: '18–22', min: 18, max: 21 },
] as const

type WeekBookingRow = {
  booking_date: string
  deposit_total: number | null
  booking_slots: { hour_start: number }[]
}
type PendingBookingRow = {
  guest_name: string | null
  customer: { username: string | null } | null
}
type RecentBookingRow = {
  id: string
  ref: string | null
  status: string
  updated_at: string
  created_at: string
  booking_date: string
  guest_name: string | null
  customer: { username: string | null } | null
}
type RecentRedemptionRow = {
  id: string
  status: string
  requested_at: string
  resolved_at: string | null
  reward: { name: string } | null
  customer: { username: string | null } | null
}
type RecentCustomerRow = {
  id: string
  username: string | null
  phone: string | null
  created_at: string
}

function buildBookingKpiData(params: {
  weekBookings: WeekBookingRow[]
  prevWeekCount: number
  monthRevenue: { deposit_total: number | null; booking_date: string }[]
  lastMonthRevenue: number
  newCustomersThisMonth: number
  newCustomersLastMonth: number
  firstPendingName: string | null
  dayDates: string[]
}): BookingKpiData {
  const {
    weekBookings,
    prevWeekCount,
    monthRevenue,
    lastMonthRevenue,
    newCustomersThisMonth,
    newCustomersLastMonth,
    firstPendingName,
    dayDates,
  } = params

  const dayCountMap = new Map<string, number>()
  dayDates.forEach((d) => dayCountMap.set(d, 0))
  weekBookings.forEach((b) => {
    dayCountMap.set(b.booking_date, (dayCountMap.get(b.booking_date) ?? 0) + 1)
  })

  const dayRevenueMap = new Map<string, number>()
  dayDates.forEach((d) => dayRevenueMap.set(d, 0))
  monthRevenue.forEach((b) => {
    if (dayRevenueMap.has(b.booking_date)) {
      dayRevenueMap.set(b.booking_date, (dayRevenueMap.get(b.booking_date) ?? 0) + (b.deposit_total ?? 0))
    }
  })

  return {
    bookingsThisWeek: weekBookings.length,
    bookingsLastWeek: prevWeekCount,
    bookingsLast7Days: dayDates.map((d) => dayCountMap.get(d) ?? 0),
    revenueThisMonth: monthRevenue.reduce((s, b) => s + (b.deposit_total ?? 0), 0),
    revenueLastMonth: lastMonthRevenue,
    revenueLast7Days: dayDates.map((d) => dayRevenueMap.get(d) ?? 0),
    newCustomersThisMonth,
    newCustomersLastMonth,
    firstPendingName,
  }
}

function buildCourtUtil(weekBookings: WeekBookingRow[], dayDates: string[]): CourtUtilDay[] {
  const dayCountMap = new Map<string, number>()
  dayDates.forEach((d) => dayCountMap.set(d, 0))
  weekBookings.forEach((b) => {
    dayCountMap.set(b.booking_date, (dayCountMap.get(b.booking_date) ?? 0) + 1)
  })
  return dayDates.map((d) => ({
    label: dayLabel(d),
    pct: Math.round(((dayCountMap.get(d) ?? 0) / 16) * 100),
  }))
}

/** Weekly utilization for a full calendar month (W1–W5). */
function buildPeriodCourtUtil(bookings: WeekBookingRow[], month: number, year: number): CourtUtilDay[] {
  const daysInMonth = new Date(year, month, 0).getDate()
  const weeks: Array<{ label: string; start: number; end: number }> = [
    { label: 'W1', start: 1, end: 7 },
    { label: 'W2', start: 8, end: 14 },
    { label: 'W3', start: 15, end: 21 },
    { label: 'W4', start: 22, end: Math.min(28, daysInMonth) },
  ]
  if (daysInMonth > 28) weeks.push({ label: 'W5', start: 29, end: daysInMonth })
  return weeks.map(({ label, start, end }) => {
    const daysInWeek = end - start + 1
    const count = bookings.filter((b) => {
      const day = Number(b.booking_date.slice(8, 10))
      return day >= start && day <= end
    }).length
    return { label, pct: Math.round((count / (daysInWeek * 16)) * 100) }
  })
}

function buildPeakBlocks(weekBookings: WeekBookingRow[]): PeakHourBlock[] {
  const blockMap = new Map<string, number>()
  HOUR_BLOCKS.forEach((b) => blockMap.set(b.label, 0))
  weekBookings.forEach((booking) => {
    booking.booking_slots?.forEach((slot) => {
      const block = HOUR_BLOCKS.find((b) => slot.hour_start >= b.min && slot.hour_start <= b.max)
      if (block) blockMap.set(block.label, (blockMap.get(block.label) ?? 0) + 1)
    })
  })
  return HOUR_BLOCKS.map((b) => ({ block: b.label, count: blockMap.get(b.label) ?? 0 }))
}

function buildActivityFeed(
  bookingEvents: RecentBookingRow[],
  redemptionEvents: RecentRedemptionRow[],
  newCustomers: RecentCustomerRow[],
): ActivityFeedItem[] {
  const items: ActivityFeedItem[] = []

  bookingEvents.forEach((b) => {
    const name = b.guest_name ?? (b.customer as { username: string | null } | null)?.username ?? 'Guest'
    items.push({
      id: `b-${b.id}`,
      type: b.status === 'confirmed' ? 'booking_confirmed' : 'booking_pending',
      name,
      detail: b.ref ?? undefined,
      timestamp: b.status === 'confirmed' ? b.updated_at : b.created_at,
    })
  })

  redemptionEvents.forEach((r) => {
    const name = (r.customer as { username: string | null } | null)?.username ?? 'Unknown'
    items.push({
      id: `r-${r.id}`,
      type: r.status === 'approved' ? 'redemption_approved' : 'redemption_rejected',
      name,
      detail: (r.reward as { name: string } | null)?.name ?? undefined,
      timestamp: (r.status === 'approved' ? r.resolved_at : null) ?? r.requested_at,
    })
  })

  newCustomers.forEach((p) => {
    items.push({
      id: `c-${p.id}`,
      type: 'new_customer',
      name: p.username ?? p.phone?.slice(-4) ?? 'Unknown',
      timestamp: p.created_at,
    })
  })

  return items.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 8)
}

const MIN_YEAR = 2023
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const AMBER = '#BA7517'
const BLUE = '#2563eb'

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>
}) {
  const profile = await getCurrentUser()
  const supabase = await createClient()
  const isSuperAdmin = profile?.role === 'superadmin'

  // ── Period params (parsed for all roles; only used by superadmin) ──────────
  const now = new Date()
  const currentYear = now.getFullYear()
  const sp = await searchParams
  const pm = Number(sp.month)
  const py = Number(sp.year)
  const month = Number.isInteger(pm) && pm >= 1 && pm <= 12 ? pm : now.getMonth() + 1
  const year = Number.isInteger(py) && py >= MIN_YEAR && py <= currentYear ? py : currentYear

  // ── Shared date ranges (Myanmar TZ) ──────────────────────────────────────────
  const todayYangon = yangonDate()
  const sixDaysAgoYangon = yangonDate(-6)
  const prevWeekStartYangon = yangonDate(-13)

  const [y, m] = todayYangon.split('-').map(Number)
  const thisMonthStartISO = new Date(y, m - 1, 1).toISOString()
  const lmy = m === 1 ? y - 1 : y
  const lmm = m === 1 ? 12 : m - 1
  const lastMonthStartISO = new Date(lmy, lmm - 1, 1).toISOString()
  const thisMonthStartDate = `${y}-${String(m).padStart(2, '0')}-01`
  const lastMonthStartDate = `${lmy}-${String(lmm).padStart(2, '0')}-01`

  const dayDates: string[] = Array.from({ length: 7 }, (_, i) => yangonDate(-(6 - i)))

  // ── Shared booking queries (both roles) ────────────────────────────────────
  const [
    weekBookingsResult,
    prevWeekResult,
    monthRevenueResult,
    lastMonthRevenueResult,
    firstPendingResult,
    recentBookingEventsResult,
    recentRedemptionEventsResult,
    recentNewCustomersResult,
    newCustomersThisMonthResult,
    newCustomersLastMonthResult,
  ] = await Promise.all([
    supabase
      .from('bookings')
      .select('booking_date, deposit_total, booking_slots(hour_start)')
      .eq('status', 'confirmed')
      .gte('booking_date', sixDaysAgoYangon)
      .lte('booking_date', todayYangon),
    supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'confirmed')
      .gte('booking_date', prevWeekStartYangon)
      .lt('booking_date', sixDaysAgoYangon),
    supabase
      .from('bookings')
      .select('deposit_total, booking_date')
      .eq('status', 'confirmed')
      .gte('booking_date', thisMonthStartDate)
      .lte('booking_date', todayYangon),
    supabase
      .from('bookings')
      .select('deposit_total')
      .eq('status', 'confirmed')
      .gte('booking_date', lastMonthStartDate)
      .lt('booking_date', thisMonthStartDate),
    supabase
      .from('bookings')
      .select('guest_name, customer:profiles!customer_id(username)')
      .eq('status', 'pending')
      .eq('deposit_received', false)
      .order('created_at', { ascending: true })
      .limit(1),
    supabase
      .from('bookings')
      .select('id, ref, status, updated_at, created_at, booking_date, guest_name, customer:profiles!customer_id(username)')
      .in('status', ['confirmed', 'pending'])
      .order('updated_at', { ascending: false })
      .limit(5),
    supabase
      .from('redemption_requests')
      .select('id, status, requested_at, resolved_at, reward:rewards(name), customer:profiles!customer_id(username)')
      .in('status', ['approved', 'rejected'])
      .order('requested_at', { ascending: false })
      .limit(5),
    supabase
      .from('profiles')
      .select('id, username, phone, created_at')
      .eq('role', 'customer')
      .order('created_at', { ascending: false })
      .limit(3),
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'customer')
      .gte('created_at', thisMonthStartISO),
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'customer')
      .gte('created_at', lastMonthStartISO)
      .lt('created_at', thisMonthStartISO),
  ])

  const weekBookings = (weekBookingsResult.data ?? []) as WeekBookingRow[]
  const prevWeekCount = prevWeekResult.count ?? 0
  const monthRevenue = (monthRevenueResult.data ?? []) as { deposit_total: number | null; booking_date: string }[]
  const lastMonthRevenue = (lastMonthRevenueResult.data ?? []).reduce(
    (s, b) => s + ((b as { deposit_total: number | null }).deposit_total ?? 0),
    0,
  )
  const firstPendingRaw = ((firstPendingResult.data ?? []) as unknown as PendingBookingRow[])[0]
  const firstPendingName =
    firstPendingRaw?.guest_name ??
    (firstPendingRaw?.customer as { username: string | null } | null)?.username ??
    null

  // Used by admin branch (hardcoded current week/month)
  const bookingKpiData = buildBookingKpiData({
    weekBookings,
    prevWeekCount,
    monthRevenue,
    lastMonthRevenue,
    newCustomersThisMonth: newCustomersThisMonthResult.count ?? 0,
    newCustomersLastMonth: newCustomersLastMonthResult.count ?? 0,
    firstPendingName,
    dayDates,
  })
  const courtUtilDays = buildCourtUtil(weekBookings, dayDates)
  const peakBlocks = buildPeakBlocks(weekBookings)
  const activityFeed = buildActivityFeed(
    (recentBookingEventsResult.data ?? []) as unknown as RecentBookingRow[],
    (recentRedemptionEventsResult.data ?? []) as unknown as RecentRedemptionRow[],
    (recentNewCustomersResult.data ?? []) as unknown as RecentCustomerRow[],
  )

  // ── SUPERADMIN BRANCH ────────────────────────────────────────────────────────
  if (isSuperAdmin) {
    const periodStart = new Date(year, month - 1, 1).toISOString()
    const periodEnd = new Date(year, month, 1).toISOString()
    const daysInMonth = new Date(year, month, 0).getDate()

    const nextMonth = month === 12 ? 1 : month + 1
    const nextYear = month === 12 ? year + 1 : year
    const prevMonth = month === 1 ? 12 : month - 1
    const prevYear = month === 1 ? year - 1 : year
    const periodStartDate = `${year}-${String(month).padStart(2, '0')}-01`
    const periodEndDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
    const prevPeriodStartDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`
    const prevPeriodStart = new Date(prevYear, prevMonth - 1, 1).toISOString()

    const periodLabel = `${MONTH_SHORT[month - 1]} ${year}`

    const [
      { data: allEarn },
      { data: earnThisMonth },
      { data: monthTx },
      { count: approvedThisMonth },
      { count: totalRedeemedAllTime },
      // Period booking data
      { data: periodBookingsRaw },
      { count: prevPeriodBookingCount },
      { data: prevPeriodRevenueData },
      { count: newCustomersPeriodCount },
      { count: newCustomersLastPeriodCount },
      // All-time data
      { data: allTimeStatuses },
      { data: allTimeTopCustomersData },
      { count: allTimeCustomerCount },
      { data: allTimeTopRewardsData },
    ] = await Promise.all([
      supabase.from('point_transactions').select('points_delta').eq('transaction_type', 'earn'),
      supabase
        .from('point_transactions')
        .select('points_delta')
        .eq('transaction_type', 'earn')
        .gte('created_at', periodStart)
        .lt('created_at', periodEnd),
      supabase
        .from('point_transactions')
        .select('points_delta, transaction_type, created_at')
        .gte('created_at', periodStart)
        .lt('created_at', periodEnd),
      supabase
        .from('redemption_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved')
        .gte('requested_at', periodStart)
        .lt('requested_at', periodEnd),
      supabase
        .from('redemption_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved'),
      // Period bookings (for booking KPI cards + charts)
      supabase
        .from('bookings')
        .select('booking_date, deposit_total, booking_slots(hour_start)')
        .eq('status', 'confirmed')
        .gte('booking_date', periodStartDate)
        .lt('booking_date', periodEndDate),
      supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'confirmed')
        .gte('booking_date', prevPeriodStartDate)
        .lt('booking_date', periodStartDate),
      supabase
        .from('bookings')
        .select('deposit_total')
        .eq('status', 'confirmed')
        .gte('booking_date', prevPeriodStartDate)
        .lt('booking_date', periodStartDate),
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'customer')
        .gte('created_at', periodStart)
        .lt('created_at', periodEnd),
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'customer')
        .gte('created_at', prevPeriodStart)
        .lt('created_at', periodStart),
      // All-time donut data
      supabase.from('redemption_requests').select('status'),
      // All-time top customers by total_points
      supabase
        .from('profiles')
        .select('id, username, phone, total_points')
        .eq('role', 'customer')
        .order('total_points', { ascending: false })
        .limit(5),
      // All-time total customer count
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'customer'),
      // All-time approved redemptions with reward name (for top redeemed rewards)
      supabase
        .from('redemption_requests')
        .select('reward_id, reward:rewards(name)')
        .eq('status', 'approved')
        .limit(500),
    ])

    const pointsIssuedAllTime = allEarn?.reduce((s, t) => s + t.points_delta, 0) ?? 0
    const pointsIssuedMonth = earnThisMonth?.reduce((s, t) => s + t.points_delta, 0) ?? 0

    // Points bar chart data
    const dailyMap = new Map<string, { issued: number; redeemed: number }>()
    monthTx?.forEach((tx) => {
      const date = tx.created_at.slice(0, 10)
      const entry = dailyMap.get(date) ?? { issued: 0, redeemed: 0 }
      if (tx.transaction_type === 'earn') entry.issued += tx.points_delta
      else entry.redeemed += Math.abs(tx.points_delta)
      dailyMap.set(date, entry)
    })
    const chartData: DailyPoint[] = []
    for (let day = 1; day <= daysInMonth; day++) {
      const mm = String(month).padStart(2, '0')
      const dd = String(day).padStart(2, '0')
      const key = `${year}-${mm}-${dd}`
      const entry = dailyMap.get(key) ?? { issued: 0, redeemed: 0 }
      chartData.push({ date: `${mm}-${dd}`, ...entry })
    }

    // All-time donut data
    const allTimeStatusCounts: Record<string, number> = { pending: 0, approved: 0, rejected: 0, cancelled: 0 }
    ;(allTimeStatuses ?? []).forEach((r) => {
      if (r.status in allTimeStatusCounts) allTimeStatusCounts[r.status]++
    })
    const donutData: StatusEntry[] = Object.entries(allTimeStatusCounts).map(([status, value]) => ({ status, value }))

    // All-time top customers
    type AllTimeCustomerRow = { id: string; username: string | null; phone: string | null; total_points: number }
    const topCustomers: CustomerEntry[] = (allTimeTopCustomersData ?? []).map((c) => {
      const row = c as unknown as AllTimeCustomerRow
      return {
        label: row.username ?? row.phone?.slice(-6) ?? '????',
        total_points: row.total_points,
      }
    })

    // All-time top redeemed rewards
    type TopRewardRaw = { reward_id: string | null; reward: { name: string } | null }
    const rewardCountMap = new Map<string, { name: string; count: number }>()
    ;(allTimeTopRewardsData ?? []).forEach((r) => {
      const raw = r as unknown as TopRewardRaw
      const name = (raw.reward as { name: string } | null)?.name
      if (!name) return
      const existing = rewardCountMap.get(name) ?? { name, count: 0 }
      existing.count++
      rewardCountMap.set(name, existing)
    })
    const topRewards = [...rewardCountMap.values()].sort((a, b) => b.count - a.count).slice(0, 3)

    // Period booking KPI data
    const periodBookings = (periodBookingsRaw ?? []) as WeekBookingRow[]
    const periodRevenue = periodBookings.reduce((s, b) => s + (b.deposit_total ?? 0), 0)
    const prevPeriodRevenue = (prevPeriodRevenueData ?? []).reduce(
      (s, b) => s + ((b as { deposit_total: number | null }).deposit_total ?? 0),
      0,
    )
    const periodBookingKpiData: BookingKpiData = {
      bookingsThisWeek: periodBookings.length,
      bookingsLastWeek: prevPeriodBookingCount ?? 0,
      bookingsLast7Days: [],
      revenueThisMonth: periodRevenue,
      revenueLastMonth: prevPeriodRevenue,
      revenueLast7Days: [],
      newCustomersThisMonth: newCustomersPeriodCount ?? 0,
      newCustomersLastMonth: newCustomersLastPeriodCount ?? 0,
      firstPendingName,
    }
    const periodCourtUtilDays = buildPeriodCourtUtil(periodBookings, month, year)
    const periodPeakBlocks = buildPeakBlocks(periodBookings)

    return (
      <div className="space-y-5">
        <h1 className="text-xl font-bold text-gray-900">
          <T k="admin.pageHeadingDashboard" />
        </h1>

        {/* ── PERIOD-FILTERED: bookings + loyalty ───────────────────── */}
        <DashboardPeriodSection
          month={month}
          year={year}
          minYear={MIN_YEAR}
          maxYear={currentYear}
          periodLabel={periodLabel}
          bookingKpiData={periodBookingKpiData}
          courtUtilDays={periodCourtUtilDays}
          peakBlocks={periodPeakBlocks}
          pointsIssued={pointsIssuedMonth}
          approvals={approvedThisMonth ?? 0}
          totalRedeemedAllTime={totalRedeemedAllTime ?? 0}
          chartData={chartData}
          donutData={donutData}
        />

        {/* ── ALL-TIME OVERVIEW ─────────────────────────────────────── */}
        <SectionDivider label={<T k="admin.dashOverviewSection" />} color="#64748b" />

        <div className="grid grid-cols-2 gap-3">
          <div
            className="bg-white border border-gray-100 rounded-xl rounded-l-none border-l-4 shadow-sm px-3 py-2.5"
            style={{ borderLeftColor: AMBER }}
          >
            <p className="text-xs text-gray-500 flex items-center gap-1.5">
              <T k="admin.pointsIssued" />
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400 font-medium">
                <T k="admin.dashAllTime" />
              </span>
            </p>
            <p className="text-2xl font-bold leading-none mt-1" style={{ color: AMBER }}>
              {pointsIssuedAllTime.toLocaleString()}
            </p>
          </div>

          <div
            className="bg-white border border-gray-100 rounded-xl rounded-l-none border-l-4 shadow-sm px-3 py-2.5"
            style={{ borderLeftColor: BLUE }}
          >
            <p className="text-xs text-gray-500 flex items-center gap-1.5">
              <T k="admin.dashTotalCustomers" />
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400 font-medium">
                <T k="admin.dashAllTime" />
              </span>
            </p>
            <p className="text-2xl font-bold leading-none mt-1" style={{ color: BLUE }}>
              {(allTimeCustomerCount ?? 0).toLocaleString()}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              <T k="admin.dashJoinedPeriod" vars={{ count: String(newCustomersPeriodCount ?? 0), period: periodLabel }} />
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <T k="admin.topCustomers" />
              <span className="text-xs font-normal text-gray-400">
                (<T k="admin.byPoints" />)
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400 font-medium ml-auto">
                <T k="admin.dashAllTime" />
              </span>
            </h2>
            <TopCustomersWithProgress data={topCustomers} />

            {/* Most redeemed rewards sub-section */}
            <div className="border-t border-gray-100 mt-3 pt-3">
              <p className="text-xs font-semibold text-gray-500 flex items-center gap-1.5 mb-2">
                <T k="admin.dashMostRedeemedRewards" />
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400 font-medium">
                  <T k="admin.dashAllTime" />
                </span>
              </p>
              {topRewards.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-2">
                  <T k="admin.dashNoRedemptions" />
                </p>
              ) : (
                <div className="space-y-2">
                  {topRewards.map((r, i) => {
                    const pct = Math.max(8, (r.count / topRewards[0].count) * 100)
                    return (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="flex-1 font-medium text-gray-700 truncate">{r.name}</span>
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden shrink-0">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: AMBER }}
                          />
                        </div>
                        <span className="font-semibold tabular-nums shrink-0" style={{ color: AMBER }}>
                          {r.count}×
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              <T k="admin.recentActivity" />
            </h2>
            <RecentActivityFeed items={activityFeed} />
          </div>
        </div>
      </div>
    )
  }

  // ── ADMIN (non-superadmin) BRANCH ─────────────────────────────────────────
  const [
    { count: customerCount },
    { data: customerPointsData },
    { count: redeemedCount },
    { count: pendingCount },
    { count: approvedThisMonthAdmin },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'customer'),
    supabase.from('profiles').select('total_points').eq('role', 'customer'),
    supabase
      .from('redemption_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved'),
    supabase
      .from('redemption_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('redemption_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved')
      .gte('requested_at', thisMonthStartISO),
  ])

  const totalPointsOutstanding = customerPointsData?.reduce((s, p) => s + p.total_points, 0) ?? 0

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">
        <T k="admin.pageHeadingDashboard" />
      </h1>

      {/* ── BOOKINGS SECTION ──────────────────────────────────────── */}
      <SectionDivider label={<T k="admin.dashBookingsSection" />} color="#1D9E75" />

      <BookingKpiCards data={bookingKpiData} />
      <BookingChartsRow utilDays={courtUtilDays} peakBlocks={peakBlocks} />

      {/* ── LOYALTY SECTION ───────────────────────────────────────── */}
      <SectionDivider label={<T k="admin.dashLoyaltySection" />} color={AMBER} />

      <EarningRuleCard rate={POINTS_PER_HOUR} />

      <div className="grid grid-cols-2 gap-3">
        {(
          [
            { value: totalPointsOutstanding, labelKey: 'admin.pointsOutstanding' as const },
            { value: pendingCount ?? 0, labelKey: 'admin.pendingRequestsStat' as const },
            { value: approvedThisMonthAdmin ?? 0, labelKey: 'admin.approvalsThisMonth' as const },
            { value: redeemedCount ?? 0, labelKey: 'admin.dashTotalRedeemedAllTime' as const },
          ] as const
        ).map(({ value, labelKey }) => (
          <div
            key={labelKey}
            className="bg-white border border-gray-100 rounded-xl rounded-l-none border-l-4 shadow-sm px-3 py-2.5"
            style={{ borderLeftColor: AMBER }}
          >
            <p className="text-xs text-gray-500">
              <T k={labelKey} />
            </p>
            <p className="text-2xl font-bold leading-none mt-1" style={{ color: AMBER }}>
              {value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* ── BOTTOM ROW ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">
            <T k="admin.totalMembers" />
          </h2>
          <p className="text-3xl font-bold text-gray-800">
            {(customerCount ?? 0).toLocaleString()}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            <T k="admin.recentActivity" />
          </h2>
          <RecentActivityFeed items={activityFeed} />
        </div>
      </div>
    </div>
  )
}
