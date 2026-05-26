'use client'

import { useTransition } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import PeriodLabel from './PeriodLabel'
import PeriodSelector from './PeriodSelector'
import ChartsSection from './ChartsSection'
import PendingRedemptionsBanner from '@/components/admin/PendingRedemptionsBanner'
import Card from '@/components/ui/Card'
import T from '@/components/ui/T'
import type { DailyPoint } from './PointsBarChart'
import type { StatusEntry } from './StatusDonut'
import type { RewardEntry } from './TopRewardsBar'
import type { CustomerEntry } from './TopCustomersBar'

interface DashboardPeriodSectionProps {
  // Period config
  month: number
  year: number
  minYear: number
  maxYear: number
  // Period-scoped stat values
  newCustomers: number
  pointsIssued: number
  approvals: number
  pendingThisMonth: number
  // Chart data
  chartData: DailyPoint[]
  donutData: StatusEntry[]
  topRewards: RewardEntry[]
  topCustomers: CustomerEntry[]
}

/** Skeleton block that replaces a stat number while the period is loading. */
function StatNumberSkeleton() {
  return <div className="h-8 w-20 bg-gray-200 rounded mx-auto animate-pulse" />
}

/** Stat card that can swap its number for a skeleton when `loading` is true. */
function PeriodStatCard({
  value,
  label,
  loading,
}: {
  value: number
  label: React.ReactNode
  loading: boolean
}) {
  return (
    <Card className="text-center py-3 px-2">
      {loading ? (
        <StatNumberSkeleton />
      ) : (
        <p className="text-2xl font-bold text-gray-800">{value.toLocaleString()}</p>
      )}
      <p className="text-xs text-gray-500 mt-0.5 leading-tight">{label}</p>
    </Card>
  )
}

export default function DashboardPeriodSection({
  month,
  year,
  minYear,
  maxYear,
  newCustomers,
  pointsIssued,
  approvals,
  pendingThisMonth,
  chartData,
  donutData,
  topRewards,
  topCustomers,
}: DashboardPeriodSectionProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const pathname = usePathname()

  function handleNavigate(nextMonth: number, nextYear: number) {
    startTransition(() => {
      router.replace(`${pathname}?month=${nextMonth}&year=${nextYear}`, { scroll: false })
    })
  }

  return (
    <>
      {/* Period-scoped KPIs */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            <PeriodLabel month={month} year={year} />
          </p>
          <PeriodSelector
            month={month}
            year={year}
            minYear={minYear}
            maxYear={maxYear}
            onNavigate={handleNavigate}
            disabled={isPending}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <PeriodStatCard
            value={newCustomers}
            label={<T k="admin.newCustomersMonth" />}
            loading={isPending}
          />
          <PeriodStatCard
            value={pointsIssued}
            label={<T k="admin.pointsIssuedMonth" />}
            loading={isPending}
          />
          <PeriodStatCard
            value={approvals}
            label={<T k="admin.approvalsThisMonth" />}
            loading={isPending}
          />
          <PeriodStatCard
            value={pendingThisMonth}
            label={<T k="admin.pendingRedemptions" />}
            loading={isPending}
          />
        </div>
      </div>

      <PendingRedemptionsBanner />

      <ChartsSection
        pointsChartData={chartData}
        donutData={donutData}
        topRewards={topRewards}
        topCustomers={topCustomers}
        month={month}
        year={year}
        isPending={isPending}
      />
    </>
  )
}
