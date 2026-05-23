import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import Card from '@/components/ui/Card'
import TransactionItem from '@/components/customer/TransactionItem'
import PendingRedemptionsBanner from '@/components/admin/PendingRedemptionsBanner'
import T from '@/components/ui/T'
import ChartsSection from '@/components/admin/analytics/ChartsSection'
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

export default async function AdminDashboardPage() {
  const profile = await getCurrentUser()
  const supabase = await createClient()
  const isSuperAdmin = profile?.role === 'superadmin'

  if (isSuperAdmin) {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const [
      { count: customerCount },
      { count: newCustomersThisMonth },
      { data: allEarn },
      { data: allRedeem },
      { data: earnThisMonth },
      { data: last30DaysTx },
      { data: allStatuses },
      { count: approvedThisMonth },
      { count: pendingCount },
      { count: activeRewardsCount },
      { data: approvedRedemptions },
      { data: topCustomers },
      { data: recentTx },
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'customer'),
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'customer')
        .gte('created_at', startOfMonth),
      supabase
        .from('point_transactions')
        .select('points_delta')
        .eq('transaction_type', 'earn'),
      supabase
        .from('point_transactions')
        .select('points_delta')
        .eq('transaction_type', 'redeem'),
      supabase
        .from('point_transactions')
        .select('points_delta')
        .eq('transaction_type', 'earn')
        .gte('created_at', startOfMonth),
      supabase
        .from('point_transactions')
        .select('points_delta, transaction_type, created_at')
        .gte('created_at', thirtyDaysAgo),
      supabase.from('redemption_requests').select('status'),
      supabase
        .from('redemption_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved')
        .gte('resolved_at', startOfMonth),
      supabase
        .from('redemption_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabase
        .from('rewards')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .eq('is_deleted', false),
      supabase
        .from('redemption_requests')
        .select('reward_id, reward:rewards(name)')
        .eq('status', 'approved'),
      supabase
        .from('profiles')
        .select('username, phone, total_points')
        .eq('role', 'customer')
        .order('total_points', { ascending: false })
        .limit(5),
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

    // Daily chart data (last 30 days)
    const dailyMap = new Map<string, { issued: number; redeemed: number }>()
    last30DaysTx?.forEach((tx) => {
      const date = tx.created_at.slice(0, 10)
      const entry = dailyMap.get(date) ?? { issued: 0, redeemed: 0 }
      if (tx.transaction_type === 'earn') entry.issued += tx.points_delta
      else entry.redeemed += Math.abs(tx.points_delta)
      dailyMap.set(date, entry)
    })
    const chartData: DailyPoint[] = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000)
      const key = d.toISOString().slice(0, 10)
      const entry = dailyMap.get(key) ?? { issued: 0, redeemed: 0 }
      chartData.push({ date: key.slice(5), ...entry })
    }

    // Redemption status donut
    const statusCounts: Record<string, number> = {
      pending: 0,
      approved: 0,
      rejected: 0,
      cancelled: 0,
    }
    allStatuses?.forEach((r) => {
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

    // Top customers by total points
    const topCustomerEntries: CustomerEntry[] = (topCustomers ?? []).map((c) => ({
      label: c.username ?? c.phone?.slice(-6) ?? '????',
      total_points: c.total_points,
    }))

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

        {/* This Month KPIs */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            <T k="admin.secondaryMetrics" />
          </p>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              value={newCustomersThisMonth ?? 0}
              label={<T k="admin.newCustomersMonth" />}
            />
            <StatCard value={pointsIssuedMonth} label={<T k="admin.pointsIssuedMonth" />} />
            <StatCard value={approvedThisMonth ?? 0} label={<T k="admin.approvalsThisMonth" />} />
            <StatCard value={pendingCount ?? 0} label={<T k="admin.pendingRedemptions" />} />
          </div>
        </div>

        <PendingRedemptionsBanner initialCount={pendingCount ?? 0} />

        <ChartsSection
          pointsChartData={chartData}
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
    { count: pendingCount },
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
    supabase
      .from('redemption_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
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

      <PendingRedemptionsBanner initialCount={pendingCount ?? 0} />

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
