'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export type DailyPoint = { date: string; issued: number; redeemed: number }

export default function PointsBarChart({ data }: { data: DailyPoint[] }) {
  const { t } = useLanguage()

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
        <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={6} />
        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          labelStyle={{ fontWeight: 600 }}
        />
        <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="issued" name={t('admin.issued')} fill="#16a34a" radius={[2, 2, 0, 0]} />
        <Bar dataKey="redeemed" name={t('admin.redeemed')} fill="#86efac" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
