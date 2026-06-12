'use client'

import dynamic from 'next/dynamic'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { CourtUtilDay } from './CourtUtilChart'
import type { PeakHourBlock } from './PeakHoursChart'

export type { CourtUtilDay, PeakHourBlock }

const ChartSkeleton = ({ h = 160 }: { h?: number }) => (
  <div className="w-full bg-gray-100 animate-pulse rounded-xl" style={{ height: h }} />
)

const CourtUtilChart = dynamic(() => import('./CourtUtilChart'), {
  ssr: false,
  loading: () => <ChartSkeleton />,
})

const PeakHoursChart = dynamic(() => import('./PeakHoursChart'), {
  ssr: false,
  loading: () => <ChartSkeleton />,
})

export default function BookingChartsRow({
  utilDays,
  peakBlocks,
  periodLabel,
  loading = false,
}: {
  utilDays: CourtUtilDay[]
  peakBlocks: PeakHourBlock[]
  periodLabel?: string
  loading?: boolean
}) {
  const { t } = useLanguage()
  const utilSubtitle = periodLabel ? `(${periodLabel}, weekly)` : '(last 7 days)'
  const peakSubtitle = periodLabel ? `(${periodLabel})` : '(last 7 days)'

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">
          {t('admin.dashCourtUtil')}
          <span className="text-xs font-normal text-gray-400 ml-1">{utilSubtitle}</span>
        </h3>
        {loading ? <ChartSkeleton /> : <CourtUtilChart data={utilDays} />}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">
          {t('admin.dashPeakHours')}
          <span className="text-xs font-normal text-gray-400 ml-1">{peakSubtitle}</span>
        </h3>
        {loading ? <ChartSkeleton /> : <PeakHoursChart data={peakBlocks} />}
      </div>
    </div>
  )
}
