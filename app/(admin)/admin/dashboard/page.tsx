import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import Card from '@/components/ui/Card'
import TransactionItem from '@/components/customer/TransactionItem'
import PendingRedemptionsBanner from '@/components/admin/PendingRedemptionsBanner'
import T from '@/components/ui/T'
import DashboardPeriodSection from '@/components/admin/analytics/DashboardPeriodSection'
import type { PointTransaction } from '@/types'
import type { DailyPoint } from '@/components/admin/analytics/PointsBarChart'
import type { StatusEntry } from '@/components/admin/analytics/StatusDonut'
import type { RewardEntry } from '@/components/admin/analytics/TopRewardsBar'
import type { CustomerEntry } from '@/components/admin/analytics/TopCustomersBar'

function StatCard({
  value,
  label,
  accent = false,
}: {
  value: string | number
  label: React.ReactNode
  accent?: boolean
}) {
  return (
    <Card className="text-center py-3 px-2">
      <p className={`text-2xl font-bold ${accent ? 'text-brand-600' : 'text-gray-800'}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      <p className="text-xs text-gray-500 mt-0.5 leading-tight">{label}</p>
    </Card>
  )
}

const MIN_YEAR = 2023

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>
}) {
  const profile = await getCurrentUser()
  const supabase = await createClient()
  const isSuperAdmin = profile?.role === 'superadmin'

  if (isSuperAdmin) {
    const now = new Date()
    const currentYear = now.getFullYear()

    // Resolve & clamp the selected period from query params (default: current month/year)
    const sp = await searchParams
    const pm = Number(sp.month)
    const py = Number(sp.year)
    const month =
      Number.isInteger(pm) && pm >= 1 && pm <= 12 ? pm : now.getMonth() + 1
    const year =
      Number.isInteger(py) && py >= MIN_YEAR && py <= currentYear ? py : currentYear

    const periodStart = new Date(year, month - 1, 1).toISOString()
    const periodEnd = new Date(year, month, 1).toISOString()
    const daysInMonth = new Date(year, month, 0).getDate()

    const [
      { count: customerCount },
      { count: newCustomersThisMonth },
      { data: allEarn },
      { data: allRedeem },
      { data: earnThisMonth },
      { data: monthTx },
      { data: monthStatuses },
      { count: approvedThisMonth },
      { count: pendingThisMonth },
      { count: activeRewardsCount },
      { data: approvedRedemptions },
      { data: monthEarners },
      { data: recentTx },
    ] = await Promise.all([
      // — Overview (all-time, NOT affected by period filter) —
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'customer'),
      // — Period-scoped: new customers —
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'customer')
        .gte('created_at', periodStart)
        .lt('created_at', periodEnd),
      // — Overview: all-time points issued —
      supabase
        .from('point_transactions')
        .select('points_delta')
        .eq('transaction_type', 'earn'),
      // — Overview: all-time points redeemed —
      supabase
        .from('point_transactions')
        .select('points_delta')
        .eq('transaction_type', 'redeem'),
      // — Period-scoped: points issued in month —
      supabase
        .from('point_transactions')
        .select('points_delta')
        .eq('transaction_type', 'earn')
        .gte('created_at', periodStart)
        .lt('created_at', periodEnd),
      // — Period-scoped: daily points chart (earn + redeem in month) —
      supabase
        .from('point_transactions')
        .select('points_delta, transaction_type, created_at')
        .gte('created_at', periodStart)
        .lt('created_at', periodEnd),
      // — Period-scoped: redemption statuses (by requested_at) for donut —
      supabase
        .from('redemption_requests')
        .select('status')
        .gte('requested_at', periodStart)
        .lt('requested_at', periodEnd),
      // — Period-scoped: approvals (by requested_at, consistent with the donut) —
      supabase
        .from('redemption_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved')
        .gte('requested_at', periodStart)
        .lt('requested_at', periodEnd),
      // — Period-scoped: pending requests in month (stat card) —
      supabase
        .from('redemption_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .gte('requested_at', periodStart)
        .lt('requested_at', periodEnd),
      // — Overview: active rewards (all-time) —
      supabase
        .from('rewards')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .eq('is_deleted', false),
      // — Period-scoped: top rewards by approvals (by requested_at, consistent with the donut) —
      supabase
        .from('redemption_requests')
        .select('reward_id, reward:rewards(name)')
        .eq('status', 'approved')
        .gte('requested_at', periodStart)
        .lt('requested_at', periodEnd),
      // — Period-scoped: points earned per customer in month (top customers) —
      supabase
        .from('point_transactions')
        .select('points_delta, customer_id, customer:profiles!customer_id(username, phone)')
        .eq('transaction_type', 'earn')
        .gte('created_at', periodStart)
        .lt('created_at', periodEnd),
      // — Recent transactions (all-time, latest 10) —
      supabase
        .from('point_transactions')
        .select(
          '*, reward:rewards(name), creator:profiles!created_by(username), customer:profiles!customer_id(username, phone)',
        )
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    // KPI aggregates
    const totalPointsIssued = allEarn?.reduce((s, t) => s + t.points_delta, 0) ?? 0
    const totalPointsRedeemed = Math.abs(allRedeem?.reduce((s, t) => s + t.points_delta, 0) ?? 0)
    const pointsIssuedMonth = earnThisMonth?.reduce((s, t) => s + t.points_delta, 0) ?? 0

    // Daily chart data (every day of the selected month)
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

    // Redemption status donut (selected month)
    const statusCounts: Record<string, number> = {
      pending: 0,
      approved: 0,
      rejected: 0,
      cancelled: 0,
    }
    monthStatuses?.forEach((r) => {
      if (r.status in statusCounts) statusCounts[r.status]++
    })
    const donutData: StatusEntry[] = Object.entries(statusCounts).map(([status, value]) => ({
      status,
      value,
    }))

    // Top rewards by approved redemptions
    const rewardMap = new Map<string, RewardEntry>()
    approvedRedemptions?.forEach((r) => {
      if (!r.reward_id) return
      const name = (r.reward as unknown as { name: string } | null)?.name ?? 'Unknown'
      const entry = rewardMap.get(r.reward_id) ?? { name, count: 0 }
      entry.count++
      rewardMap.set(r.reward_id, entry)
    })
    const topRewards: RewardEntry[] = [...rewardMap.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // Top customers by points earned in the selected month
    const earnerMap = new Map<string, CustomerEntry>()
    monthEarners?.forEach((tx) => {
      if (!tx.customer_id) return
      const c = tx.customer as unknown as { username: string | null; phone: string | null } | null
      const label = c?.username ?? c?.phone?.slice(-6) ?? '????'
      const entry = earnerMap.get(tx.customer_id) ?? { label, total_points: 0 }
      entry.total_points += tx.points_delta
      earnerMap.set(tx.customer_id, entry)
    })
    const topCustomerEntries: CustomerEntry[] = [...earnerMap.values()]
      .sort((a, b) => b.total_points - a.total_points)
      .slice(0, 5)

    return (
      <div className="space-y-5">
        <h1 className="text-xl font-bold text-gray-900">
          <T k="admin.pageHeadingDashboard" />
        </h1>

        {/* Primary KPIs */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            <T k="admin.analyticsOverview" />
          </p>
          <div className="grid grid-cols-2 gap-3">
            <StatCard value={customerCount ?? 0} label={<T k="admin.totalCustomers" />} accent />
            <StatCard value={totalPointsIssued} label={<T k="admin.pointsIssued" />} accent />
            <StatCard value={totalPointsRedeemed} label={<T k="admin.pointsRedeemed" />} />
            <StatCard value={activeRewardsCount ?? 0} label={<T k="admin.activeRewards" />} />
          </div>
        </div>

        <DashboardPeriodSection
          month={month}
          year={year}
          minYear={MIN_YEAR}
          maxYear={currentYear}
          newCustomers={newCustomersThisMonth ?? 0}
          pointsIssued={pointsIssuedMonth}
          approvals={approvedThisMonth ?? 0}
          pendingThisMonth={pendingThisMonth ?? 0}
          chartData={chartData}
          donutData={donutData}
          topRewards={topRewards}
          topCustomers={topCustomerEntries}
        />

        {/* Recent transactions */}
        <Card className="p-0">
          <h2 className="font-semibold text-gray-900 px-4 pt-4 pb-2">
            <T k="admin.recentTransactions" />
          </h2>
          {recentTx && recentTx.length > 0 ? (
            <div className="px-4 max-h-96 overflow-y-auto divide-y divide-gray-100">
              {recentTx.map((tx) => (
                <TransactionItem key={tx.id} tx={tx as PointTransaction} showCustomer />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-6 pb-4">
              <T k="admin.noTransactions" />
            </p>
          )}
        </Card>
      </div>
    )
  }

  // Admin (non-superadmin): existing minimal dashboard — unchanged
  const [
    { count: customerCount },
    { data: pointsData },
    { data: recentTx },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'customer'),
    supabase.from('point_transactions').select('points_delta').eq('transaction_type', 'earn'),
    supabase
      .from('point_transactions')
      .select(
        '*, reward:rewards(name), creator:profiles!created_by(username), customer:profiles!customer_id(username, phone)',
      )
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const totalPointsIssued = pointsData?.reduce((sum, t) => sum + t.points_delta, 0) ?? 0

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">
        <T k="admin.pageHeadingDashboard" />
      </h1>

      <div className="grid grid-cols-2 gap-3">
        <Card className="text-center">
          <p className="text-3xl font-bold text-brand-600">{customerCount ?? 0}</p>
          <p className="text-xs text-gray-500 mt-1">
            <T k="admin.totalCustomers" />
          </p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-brand-600">{totalPointsIssued.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">
            <T k="admin.pointsIssued" />
          </p>
        </Card>
      </div>

      <PendingRedemptionsBanner />

      <Card className="p-0">
        <h2 className="font-semibold text-gray-900 px-4 pt-4 pb-2">
          <T k="admin.recentTransactions" />
        </h2>
        {recentTx && recentTx.length > 0 ? (
          <div className="px-4 max-h-96 overflow-y-auto divide-y divide-gray-100">
            {recentTx.map((tx) => (
              <TransactionItem key={tx.id} tx={tx as PointTransaction} showCustomer />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-6 pb-4">
            <T k="admin.noTransactions" />
          </p>
        )}
      </Card>
    </div>
  )
}
