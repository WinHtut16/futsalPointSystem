'use client'

import dynamic from 'next/dynamic'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { DailyPoint } from './PointsBarChart'
import type { StatusEntry } from './StatusDonut'
import type { RewardEntry } from './TopRewardsBar'
import type { CustomerEntry } from './TopCustomersBar'

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
const TopRewardsBar = dynamic(() => import('./TopRewardsBar'), {
  ssr: false,
  loading: () => <ChartSkeleton h={180} />,
})
const TopCustomersBar = dynamic(() => import('./TopCustomersBar'), {
  ssr: false,
  loading: () => <ChartSkeleton h={180} />,
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
  topRewards: RewardEntry[]
  topCustomers: CustomerEntry[]
  /** Selected month (1–12) and year, used to label the points chart. */
  month: number
  year: number
  /** When true, chart areas show a skeleton placeholder instead of chart content. */
  isPending?: boolean
}

export default function ChartsSection({
  pointsChartData,
  donutData,
  topRewards,
  topCustomers,
  month,
  year,
  isPending = false,
}: ChartsSectionProps) {
  const { t } = useLanguage()
  const period = `${t(MONTH_KEYS[month - 1])} ${year}`
  const pointsTitle = t('admin.pointsForMonth', { period })

  return (
    <>
      {/* Charts row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">{pointsTitle}</h2>
          {isPending ? <ChartSkeleton /> : <PointsBarChart data={pointsChartData} />}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">
            {t('admin.redemptionStatus')}
          </h2>
          {isPending ? <ChartSkeleton /> : <StatusDonut data={donutData} />}
        </div>
      </div>

      {/* Top lists row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">
            {t('admin.topRewards')}
            <span className="text-xs font-normal text-gray-400 ml-1">
              ({t('admin.byApprovals')})
            </span>
          </h2>
          {isPending ? <ChartSkeleton h={180} /> : <TopRewardsBar data={topRewards} />}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">
            {t('admin.topCustomers')}
            <span className="text-xs font-normal text-gray-400 ml-1">
              ({t('admin.byPoints')})
            </span>
          </h2>
          {isPending ? <ChartSkeleton h={180} /> : <TopCustomersBar data={topCustomers} />}
        </div>
      </div>
    </>
  )
}
