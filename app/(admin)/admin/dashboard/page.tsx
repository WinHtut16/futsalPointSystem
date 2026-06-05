import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import Card from '@/components/ui/Card'
import TransactionItem from '@/components/customer/TransactionItem'
import T from '@/components/ui/T'
import DashboardPeriodSection from '@/components/admin/analytics/DashboardPeriodSection'
import EarningRuleCard from '@/components/admin/EarningRuleCard'
import type { PointTransaction, RedemptionRequest } from '@/types'
import type { DailyPoint } from '@/components/admin/analytics/PointsBarChart'
import type { StatusEntry } from '@/components/admin/analytics/StatusDonut'
import type { RewardEntry } from '@/components/admin/analytics/TopRewardsBar'
import type { CustomerEntry } from '@/components/admin/analytics/TopCustomersBar'
import Link from 'next/link'
import { Users, Zap, Clock, Gift, Star } from 'lucide-react'
import { POINTS_PER_HOUR } from '@/lib/points'

function AwaitingApprovalSection({
  requests,
  totalCount,
}: {
  requests: RedemptionRequest[]
  totalCount: number
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
        </span>
        <h2 className="text-sm font-semibold text-gray-700">
          <T k="admin.awaitingApproval" />
        </h2>
        <span className="bg-amber-100 text-amber-700 text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
          {totalCount}
        </span>
      </div>
      <div className="space-y-2">
        {requests.map((req) => (
          <div
            key={req.id}
            className="bg-white rounded-xl border border-amber-100 shadow-sm p-3 flex items-center gap-3"
          >
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
              <Gift className="w-4 h-4 text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{req.reward?.name}</p>
              <p className="text-xs text-gray-500">{req.customer?.username}</p>
            </div>
            <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
              <p className="text-xs font-bold text-brand-600">
                {req.reward?.points_cost} <T k="common.pts" />
              </p>
              <Link
                href="/admin/redemptions"
                className="text-xs bg-gray-900 text-white px-2.5 py-1 rounded-lg hover:bg-gray-800 transition-colors font-medium"
              >
                <T k="admin.reviewAction" />
              </Link>
            </div>
          </div>
        ))}
        {totalCount > requests.length && (
          <Link
            href="/admin/redemptions"
            className="block text-center text-xs text-brand-600 font-medium py-1.5 hover:underline"
          >
            +{totalCount - requests.length} more…
          </Link>
        )}
      </div>
    </section>
  )
}

function StatCard({
  icon,
  value,
  label,
  accent = false,
  warn = false,
}: {
  icon?: React.ReactNode
  value: string | number
  label: React.ReactNode
  accent?: boolean
  warn?: boolean
}) {
  const iconBg = accent
    ? 'bg-primary/10 text-primary'
    : warn
      ? 'bg-amber-50 text-amber-600'
      : 'bg-gray-100 text-gray-500'
  const valueCls = accent ? 'text-primary' : warn ? 'text-amber-600' : 'text-gray-800'

  if (icon) {
    return (
      <Card className="flex items-center gap-3 py-3 px-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className={`text-2xl font-bold leading-none ${valueCls}`}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          <p className="text-xs text-gray-500 mt-0.5 leading-tight">{label}</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="text-center py-3 px-2">
      <p className={`text-2xl font-bold ${valueCls}`}>
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
      { data: pendingRequests },
      { count: pendingCount },
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'customer'),
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'customer')
        .gte('created_at', periodStart)
        .lt('created_at', periodEnd),
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
        .gte('created_at', periodStart)
        .lt('created_at', periodEnd),
      supabase
        .from('point_transactions')
        .select('points_delta, transaction_type, created_at')
        .gte('created_at', periodStart)
        .lt('created_at', periodEnd),
      supabase
        .from('redemption_requests')
        .select('status')
        .gte('requested_at', periodStart)
        .lt('requested_at', periodEnd),
      supabase
        .from('redemption_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved')
        .gte('requested_at', periodStart)
        .lt('requested_at', periodEnd),
      supabase
        .from('redemption_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .gte('requested_at', periodStart)
        .lt('requested_at', periodEnd),
      supabase
        .from('rewards')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .eq('is_deleted', false),
      supabase
        .from('redemption_requests')
        .select('reward_id, reward:rewards(name)')
        .eq('status', 'approved')
        .gte('requested_at', periodStart)
        .lt('requested_at', periodEnd),
      supabase
        .from('point_transactions')
        .select('points_delta, customer_id, customer:profiles!customer_id(username, phone)')
        .eq('transaction_type', 'earn')
        .gte('created_at', periodStart)
        .lt('created_at', periodEnd),
      supabase
        .from('point_transactions')
        .select(
          '*, reward:rewards(name), creator:profiles!created_by(username), customer:profiles!customer_id(username, phone)',
        )
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('redemption_requests')
        .select(
          '*, reward:rewards(name, points_cost), customer:profiles!customer_id(username, phone)',
        )
        .eq('status', 'pending')
        .order('requested_at', { ascending: true })
        .limit(5),
      supabase
        .from('redemption_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),
    ])

    const totalPointsIssued = allEarn?.reduce((s, t) => s + t.points_delta, 0) ?? 0
    const totalPointsRedeemed = Math.abs(allRedeem?.reduce((s, t) => s + t.points_delta, 0) ?? 0)
    const pointsIssuedMonth = earnThisMonth?.reduce((s, t) => s + t.points_delta, 0) ?? 0

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

        {pendingRequests && pendingRequests.length > 0 && (
          <AwaitingApprovalSection
            requests={pendingRequests as RedemptionRequest[]}
            totalCount={pendingCount ?? pendingRequests.length}
          />
        )}

        <EarningRuleCard rate={POINTS_PER_HOUR} />

        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            <T k="admin.analyticsOverview" />
          </p>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={<Users className="w-5 h-5" />}
              value={customerCount ?? 0}
              label={<T k="admin.totalCustomers" />}
              accent
            />
            <StatCard
              icon={<Zap className="w-5 h-5" />}
              value={totalPointsIssued}
              label={<T k="admin.pointsIssued" />}
              accent
            />
            <StatCard
              icon={<Star className="w-5 h-5" />}
              value={totalPointsRedeemed}
              label={<T k="admin.pointsRedeemed" />}
            />
            <StatCard
              icon={<Gift className="w-5 h-5" />}
              value={activeRewardsCount ?? 0}
              label={<T k="admin.activeRewards" />}
            />
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

        <Card className="p-0">
          <h2 className="font-semibold text-gray-900 px-4 pt-4 pb-2">
            <T k="admin.recentActivity" />
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

  // Admin (non-superadmin): redesigned dashboard
  const [
    { count: customerCount },
    { data: recentTx },
    { data: pendingRequests },
    { data: customerPointsData },
    { count: redeemedCount },
    { count: pendingCount },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'customer'),
    supabase
      .from('point_transactions')
      .select(
        '*, reward:rewards(name), creator:profiles!created_by(username), customer:profiles!customer_id(username, phone)',
      )
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('redemption_requests')
      .select(
        '*, reward:rewards(name, points_cost), customer:profiles!customer_id(username, phone)',
      )
      .eq('status', 'pending')
      .order('requested_at', { ascending: true })
      .limit(5),
    supabase.from('profiles').select('total_points').eq('role', 'customer'),
    supabase
      .from('redemption_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved'),
    supabase
      .from('redemption_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
  ])

  const totalPointsOutstanding =
    customerPointsData?.reduce((s, p) => s + p.total_points, 0) ?? 0

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">
        <T k="admin.pageHeadingDashboard" />
      </h1>

      {pendingRequests && pendingRequests.length > 0 && (
        <AwaitingApprovalSection
          requests={pendingRequests as RedemptionRequest[]}
          totalCount={pendingCount ?? pendingRequests.length}
        />
      )}

      <EarningRuleCard rate={POINTS_PER_HOUR} />

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<Users className="w-5 h-5" />}
          value={customerCount ?? 0}
          label={<T k="admin.totalMembers" />}
          accent
        />
        <StatCard
          icon={<Zap className="w-5 h-5" />}
          value={totalPointsOutstanding}
          label={<T k="admin.pointsOutstanding" />}
        />
        <StatCard
          icon={<Clock className="w-5 h-5" />}
          value={pendingCount ?? 0}
          label={<T k="admin.pendingRequestsStat" />}
          warn={!!(pendingCount && pendingCount > 0)}
        />
        <StatCard
          icon={<Gift className="w-5 h-5" />}
          value={redeemedCount ?? 0}
          label={<T k="admin.rewardsRedeemed" />}
        />
      </div>

      <Card className="p-0">
        <h2 className="font-semibold text-gray-900 px-4 pt-4 pb-2">
          <T k="admin.recentActivity" />
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
