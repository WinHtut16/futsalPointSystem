'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { usePendingBookings } from '@/contexts/PendingBookingsContext'

export interface BookingKpiData {
  bookingsThisWeek: number
  bookingsLastWeek: number
  bookingsLast7Days: number[]
  revenueThisMonth: number
  revenueLastMonth: number
  revenueLast7Days: number[]
  newCustomersThisMonth: number
  newCustomersLastMonth: number
  firstPendingName: string | null
}

const TEAL = '#1D9E75'

function NumSkeleton() {
  return <div className="h-8 w-20 bg-gray-200 rounded animate-pulse" />
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1)
  return (
    <div className="flex items-end gap-[2px] h-7 w-full mt-1">
      {values.map((v, i) => {
        const pct = Math.max(8, (v / max) * 100)
        const opacity = 0.4 + (i / (values.length - 1)) * 0.6
        return (
          <div
            key={i}
            className="flex-1 rounded-sm"
            style={{ height: `${pct}%`, backgroundColor: color, opacity }}
          />
        )
      })}
    </div>
  )
}

function TrendBadge({ current, prev }: { current: number; prev: number }) {
  if (prev === 0 && current === 0)
    return <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">—</span>
  if (prev === 0)
    return <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">New</span>
  const pct = Math.round(((current - prev) / prev) * 100)
  if (pct === 0)
    return <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">0%</span>
  return (
    <span
      className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium transition-colors duration-200 ${
        pct > 0 ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
      }`}
    >
      {pct > 0 ? '+' : ''}
      {pct}%
    </span>
  )
}

function KpiCard({
  label,
  value,
  suffix,
  trend,
  sparkline,
  borderColor = TEAL,
  className = '',
  loading = false,
  children,
}: {
  label: string
  value: string | number
  suffix?: string
  trend?: React.ReactNode
  sparkline?: number[]
  borderColor?: string
  className?: string
  loading?: boolean
  children?: React.ReactNode
}) {
  return (
    <div
      className={`bg-white border border-gray-100 rounded-xl rounded-l-none border-l-4 shadow-sm px-3 py-2.5 flex flex-col gap-1 transition-all duration-200 ${className}`}
      style={{ borderLeftColor: borderColor }}
    >
      <p className="text-xs text-gray-500 leading-tight">{label}</p>
      <div className="flex items-end justify-between gap-1">
        {loading ? (
          <NumSkeleton />
        ) : (
          <>
            <p className="text-2xl font-bold leading-none" style={{ color: borderColor }}>
              {typeof value === 'number' ? value.toLocaleString() : value}
              {suffix && <span className="text-[11px] font-semibold ml-1 text-gray-400">{suffix}</span>}
            </p>
            {trend}
          </>
        )}
      </div>
      {!loading && sparkline && sparkline.length > 0 && <Sparkline values={sparkline} color={borderColor} />}
      {children}
    </div>
  )
}

export default function BookingKpiCards({
  data,
  periodLabel,
  loading = false,
}: {
  data: BookingKpiData
  periodLabel?: string
  loading?: boolean
}) {
  const { t } = useLanguage()
  const { count: pendingCount, loaded } = usePendingBookings()

  const pendingBorderColor = pendingCount >= 5 ? '#ef4444' : pendingCount >= 1 ? '#f59e0b' : TEAL
  const pendingBg =
    pendingCount >= 5
      ? 'bg-red-50 border-red-100'
      : pendingCount >= 1
        ? 'bg-amber-50 border-amber-100'
        : ''
  const pendingValueColor = pendingCount >= 5 ? '#ef4444' : pendingCount >= 1 ? '#f59e0b' : TEAL
  const pendingLabelColor =
    pendingCount >= 5
      ? 'text-red-600'
      : pendingCount >= 1
        ? 'text-amber-600'
        : 'text-gray-500'

  const bookingsLabel = periodLabel
    ? `${t('admin.dashBookings')} — ${periodLabel}`
    : t('admin.dashBookingsWeek')
  const revenueLabel = periodLabel
    ? `${t('admin.dashRevenue')} — ${periodLabel}`
    : t('admin.dashRevenueMonth')
  const newCustomersLabel = periodLabel
    ? `${t('admin.newCustomersMonth')} — ${periodLabel}`
    : t('admin.newCustomersMonth')

  return (
    <div className="grid grid-cols-2 gap-3">
      <KpiCard
        label={bookingsLabel}
        value={data.bookingsThisWeek}
        sparkline={data.bookingsLast7Days}
        trend={<TrendBadge current={data.bookingsThisWeek} prev={data.bookingsLastWeek} />}
        loading={loading}
      />
      <KpiCard
        label={revenueLabel}
        value={data.revenueThisMonth}
        suffix="MMK"
        sparkline={data.revenueLast7Days}
        trend={<TrendBadge current={data.revenueThisMonth} prev={data.revenueLastMonth} />}
        loading={loading}
      />
      <KpiCard
        label={newCustomersLabel}
        value={data.newCustomersThisMonth}
        trend={<TrendBadge current={data.newCustomersThisMonth} prev={data.newCustomersLastMonth} />}
        loading={loading}
      />

      {/* Awaiting confirmation — real-time from context, never skeleted */}
      <Link
        href="/admin/bookings"
        className={`bg-white border border-gray-100 rounded-xl rounded-l-none border-l-4 shadow-sm px-3 py-2.5 flex flex-col gap-1 transition-all duration-200 ${pendingBg}`}
        style={{ borderLeftColor: pendingBorderColor }}
      >
        <p className={`text-xs leading-tight ${pendingLabelColor}`}>{t('admin.dashAwaitingConf')}</p>
        <p className="text-2xl font-bold leading-none transition-colors duration-200" style={{ color: pendingValueColor }}>
          {loaded ? pendingCount : '—'}
        </p>
        {pendingCount >= 1 && data.firstPendingName && (
          <p className="text-[11px] truncate font-medium" style={{ color: pendingValueColor }}>
            {t('admin.dashFirstInQueue')}: {data.firstPendingName}
          </p>
        )}
      </Link>
    </div>
  )
}
