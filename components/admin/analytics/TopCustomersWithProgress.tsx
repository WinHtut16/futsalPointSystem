'use client'

import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { CustomerEntry } from './TopCustomersBar'

const TEAL = '#1D9E75'
const TEAL_MID = '#1D9E75cc'
const TEAL_DIM = '#1D9E7566'

export default function TopCustomersWithProgress({ data }: { data: CustomerEntry[] }) {
  const { t } = useLanguage()
  const max = Math.max(...data.map((d) => d.total_points), 1)

  if (data.length === 0) {
    return (
      <div className="h-[160px] flex items-center justify-center text-sm text-gray-400">
        {t('admin.noData')}
      </div>
    )
  }

  const barColors = [TEAL, TEAL_MID, TEAL_DIM, TEAL_DIM, TEAL_DIM]

  return (
    <div className="space-y-3">
      {data.map((customer, i) => {
        const pct = Math.max(4, (customer.total_points / max) * 100)
        return (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="w-4 h-4 rounded-full shrink-0 text-white flex items-center justify-center text-[9px] font-bold"
                  style={{ backgroundColor: barColors[i] ?? TEAL_DIM }}
                >
                  {i + 1}
                </span>
                <span className="font-medium text-gray-700 truncate">{customer.label}</span>
              </div>
              <span className="font-semibold text-gray-800 shrink-0 ml-2 tabular-nums">
                {customer.total_points.toLocaleString()}
                <span className="font-normal text-gray-400 ml-0.5">{t('admin.pts')}</span>
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: barColors[i] ?? TEAL_DIM }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
