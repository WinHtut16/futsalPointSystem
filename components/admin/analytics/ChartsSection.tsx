'use client'

import dynamic from 'next/dynamic'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { DailyPoint } from './PointsBarChart'
import type { StatusEntry } from './StatusDonut'

const ChartSkeleton = ({ h = 200 }: { h?: number }) => (
  <div className="w-full bg-gray-100 animate-pulse rounded-xl" style={{ height: h }} />
)

const PointsBarChart = dynamic(() => import('./PointsBarChart'), {
  ssr: false,
  loading: () => <ChartSkeleton />,
})
const StatusDonut = dynamic(() => import('./StatusDonut'), {
  ssr: false,
  loading: () => <ChartSkeleton />,
})

const MONTH_KEYS = [
  'admin.monthJan',
  'admin.monthFeb',
  'admin.monthMar',
  'admin.monthApr',
  'admin.monthMay',
  'admin.monthJun',
  'admin.monthJul',
  'admin.monthAug',
  'admin.monthSep',
  'admin.monthOct',
  'admin.monthNov',
  'admin.monthDec',
] as const

interface ChartsSectionProps {
  pointsChartData: DailyPoint[]
  donutData: StatusEntry[]
  month: number
  year: number
  isPending?: boolean
}

export default function ChartsSection({
  pointsChartData,
  donutData,
  month,
  year,
  isPending = false,
}: ChartsSectionProps) {
  const { t } = useLanguage()
  const period = `${t(MONTH_KEYS[month - 1])} ${year}`
  const pointsTitle = t('admin.pointsForMonth', { period })

  return (
    /* 1/3 donut + 2/3 points chart */
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3">
        <h2 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
          {t('admin.redemptionStatus')}
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400 font-medium">
            {t('admin.dashAllTime')}
          </span>
        </h2>
        {isPending ? <ChartSkeleton /> : <StatusDonut data={donutData} />}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 sm:col-span-2">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">{pointsTitle}</h2>
        {isPending ? <ChartSkeleton /> : <PointsBarChart data={pointsChartData} />}
      </div>
    </div>
  )
}
