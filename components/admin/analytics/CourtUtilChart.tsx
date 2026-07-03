'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export type CourtUtilDay = { label: string; pct: number }

const TEAL = '#1D9E75'

export default function CourtUtilChart({ data }: { data: CourtUtilDay[] }) {
  const { t } = useLanguage()

  if (data.length === 0 || data.every((d) => d.pct === 0)) {
    return (
      <div className="h-[160px] flex items-center justify-center text-sm text-gray-400">
        {t('admin.noData')}
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(140, data.length * 26)}>
      <BarChart data={data} layout="vertical" margin={{ top: 2, right: 40, left: 4, bottom: 2 }}>
        <XAxis
          type="number"
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 9 }}
          tickCount={6}
        />
        <YAxis type="category" dataKey="label" width={32} tick={{ fontSize: 10 }} />
        <Tooltip
          formatter={(v) => [`${v}%`, t('admin.dashCourtUtil')]}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Bar dataKey="pct" radius={[0, 3, 3, 0]} maxBarSize={14}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.pct >= 80 ? '#0f766e' : entry.pct >= 40 ? TEAL : `${TEAL}99`} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
