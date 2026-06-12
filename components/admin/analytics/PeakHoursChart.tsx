'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export type PeakHourBlock = { block: string; count: number }

const TEAL = '#1D9E75'

export default function PeakHoursChart({ data }: { data: PeakHourBlock[] }) {
  const { t } = useLanguage()
  const max = Math.max(...data.map((d) => d.count), 1)

  if (data.every((d) => d.count === 0)) {
    return (
      <div className="h-[160px] flex items-center justify-center text-sm text-gray-400">
        {t('admin.noData')}
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(140, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ top: 2, right: 40, left: 4, bottom: 2 }}>
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 9 }} />
        <YAxis type="category" dataKey="block" width={44} tick={{ fontSize: 10 }} />
        <Tooltip
          formatter={(v) => [v, t('admin.dashPeakHours')]}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Bar dataKey="count" radius={[0, 3, 3, 0]} maxBarSize={18}>
          {data.map((entry, i) => {
            const intensity = entry.count / max
            return (
              <Cell
                key={i}
                fill={intensity >= 0.75 ? '#0f766e' : intensity >= 0.4 ? TEAL : `${TEAL}99`}
              />
            )
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
