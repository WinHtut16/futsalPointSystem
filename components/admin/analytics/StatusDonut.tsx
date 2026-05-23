'use client'

import { PieChart, Pie, Cell, Legend, ResponsiveContainer, Tooltip } from 'recharts'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export type StatusEntry = { status: string; value: number }

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  approved: '#16a34a',
  rejected: '#ef4444',
  cancelled: '#9ca3af',
}

export default function StatusDonut({ data }: { data: StatusEntry[] }) {
  const { t } = useLanguage()

  const STATUS_LABELS: Record<string, string> = {
    pending: t('admin.statusPending'),
    approved: t('admin.statusApproved'),
    rejected: t('admin.statusRejected'),
    cancelled: t('admin.statusCancelled'),
  }

  const labeled = data
    .filter((d) => d.value > 0)
    .map((d) => ({ ...d, name: STATUS_LABELS[d.status] ?? d.status }))

  if (labeled.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-sm text-gray-400">
        {t('admin.noData')}
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={labeled}
          cx="50%"
          cy="45%"
          innerRadius={52}
          outerRadius={75}
          dataKey="value"
          paddingAngle={2}
        >
          {labeled.map((entry, i) => (
            <Cell key={i} fill={STATUS_COLORS[entry.status] ?? '#d1d5db'} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Legend iconSize={9} wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
