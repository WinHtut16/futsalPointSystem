'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export type RewardEntry = { name: string; count: number }

const BAR_FILLS = ['#15803d', '#16a34a', '#22c55e', '#4ade80', '#86efac']

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + '…' : s
}

export default function TopRewardsBar({ data }: { data: RewardEntry[] }) {
  const { t } = useLanguage()

  if (data.length === 0) {
    return (
      <div className="h-[180px] flex items-center justify-center text-sm text-gray-400">
        {t('admin.noData')}
      </div>
    )
  }

  const chartData = data.map((d) => ({ ...d, label: truncate(d.name, 14) }))

  return (
    <ResponsiveContainer width="100%" height={Math.max(160, chartData.length * 36)}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 28, left: 4, bottom: 0 }}>
        <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
        <YAxis type="category" dataKey="label" width={90} tick={{ fontSize: 10 }} />
        <Tooltip
          formatter={(v) => [typeof v === 'number' ? v : String(v ?? ''), t('admin.byApprovals')]}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Bar dataKey="count" radius={[0, 3, 3, 0]}>
          {chartData.map((_, i) => (
            <Cell key={i} fill={BAR_FILLS[i] ?? '#86efac'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
