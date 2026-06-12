'use client'

import { useTransition } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import PeriodLabel from './PeriodLabel'
import PeriodSelector from './PeriodSelector'
import ChartsSection from './ChartsSection'
import SectionDivider from './SectionDivider'
import BookingKpiCards from './BookingKpiCards'
import BookingChartsRow from './BookingChartsRow'
import EarningRuleCard from '@/components/admin/EarningRuleCard'
import { usePendingRedemptions } from '@/contexts/PendingRedemptionsContext'
import T from '@/components/ui/T'
import { POINTS_PER_HOUR } from '@/lib/points'
import type { DailyPoint } from './PointsBarChart'
import type { StatusEntry } from './StatusDonut'
import type { BookingKpiData } from './BookingKpiCards'
import type { CourtUtilDay, PeakHourBlock } from './BookingChartsRow'

const AMBER = '#BA7517'

interface DashboardPeriodSectionProps {
  month: number
  year: number
  minYear: number
  maxYear: number
  periodLabel: string
  bookingKpiData: BookingKpiData
  courtUtilDays: CourtUtilDay[]
  peakBlocks: PeakHourBlock[]
  pointsIssued: number
  approvals: number
  totalRedeemedAllTime: number
  chartData: DailyPoint[]
  donutData: StatusEntry[]
}

function NumSkeleton() {
  return <div className="h-8 w-20 bg-gray-200 rounded animate-pulse" />
}

function LoyaltyKpiCard({
  value,
  label,
  loading = false,
  live = false,
}: {
  value: number
  label: React.ReactNode
  loading?: boolean
  live?: boolean
}) {
  return (
    <div
      className="bg-white border border-gray-100 rounded-xl rounded-l-none border-l-4 shadow-sm px-3 py-2.5 flex flex-col gap-1 transition-all duration-200"
      style={{ borderLeftColor: AMBER }}
    >
      <p className="text-xs text-gray-500 leading-tight flex items-center gap-1">
        {live && (
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
          </span>
        )}
        {label}
      </p>
      {loading ? (
        <NumSkeleton />
      ) : (
        <p className="text-2xl font-bold leading-none" style={{ color: AMBER }}>
          {value.toLocaleString()}
        </p>
      )}
    </div>
  )
}

export default function DashboardPeriodSection({
  month,
  year,
  minYear,
  maxYear,
  periodLabel,
  bookingKpiData,
  courtUtilDays,
  peakBlocks,
  pointsIssued,
  approvals,
  totalRedeemedAllTime,
  chartData,
  donutData,
}: DashboardPeriodSectionProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const pathname = usePathname()
  const { count: pendingRedemptions } = usePendingRedemptions()

  function handleNavigate(nextMonth: number, nextYear: number) {
    startTransition(() => {
      router.replace(`${pathname}?month=${nextMonth}&year=${nextYear}`, { scroll: false })
    })
  }

  return (
    <>
      {/* Period selector row */}
      <div className="flex items-center justify-between gap-2">
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

      {/* ── BOOKINGS SECTION ──────────────────────────────────────── */}
      <SectionDivider label={<T k="admin.dashBookingsSection" />} color="#1D9E75" />
      <BookingKpiCards data={bookingKpiData} periodLabel={periodLabel} loading={isPending} />
      <BookingChartsRow utilDays={courtUtilDays} peakBlocks={peakBlocks} periodLabel={periodLabel} loading={isPending} />

      {/* ── LOYALTY SECTION ───────────────────────────────────────── */}
      <SectionDivider label={<T k="admin.dashLoyaltySection" />} color={AMBER} />
      <EarningRuleCard rate={POINTS_PER_HOUR} />

      {/* 4 Loyalty KPI cards */}
      <div className="grid grid-cols-2 gap-3">
        <LoyaltyKpiCard value={pointsIssued} label={<T k="admin.pointsIssuedMonth" />} loading={isPending} />
        <LoyaltyKpiCard value={pendingRedemptions} label={<T k="admin.pendingRedemptions" />} live />
        <LoyaltyKpiCard value={approvals} label={<T k="admin.approvalsThisMonth" />} loading={isPending} />
        <LoyaltyKpiCard value={totalRedeemedAllTime} label={<T k="admin.dashTotalRedeemedAllTime" />} />
      </div>

      {/* Loyalty charts: donut (all-time) + points bar (period) */}
      <ChartsSection
        pointsChartData={chartData}
        donutData={donutData}
        month={month}
        year={year}
        isPending={isPending}
      />
    </>
  )
}
