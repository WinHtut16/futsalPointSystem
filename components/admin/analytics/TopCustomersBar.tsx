'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export type CustomerEntry = { label: string; total_points: number }

export default function TopCustomersBar({ data }: { data: CustomerEntry[] }) {
  const { t } = useLanguage()

  if (data.length === 0) {
    return (
      <div className="h-[180px] flex items-center justify-center text-sm text-gray-400">
        {t('admin.noData')}
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 36, left: 4, bottom: 0 }}>
        <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
        <YAxis type="category" dataKey="label" width={90} tick={{ fontSize: 10 }} />
        <Tooltip
          formatter={(v) => [typeof v === 'number' ? v.toLocaleString() : String(v ?? ''), t('admin.pts')]}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Bar dataKey="total_points" radius={[0, 3, 3, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={i === 0 ? '#15803d' : i === 1 ? '#16a34a' : '#22c55e'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
