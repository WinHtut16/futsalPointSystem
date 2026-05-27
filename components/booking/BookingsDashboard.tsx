'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Gift } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import PointsCard from './PointsCard'
import BookingHistoryCard, { type BookingStatus } from './BookingHistoryCard'

export type DashboardBooking = {
  id: string
  status: BookingStatus
  dateLabel: string
  timeLabel: string
  refCode: string
  deposit: string
  canCancel: boolean
}

export default function BookingsDashboard({
  name,
  points,
  upcoming,
  history,
}: {
  name: string
  points: number
  upcoming: DashboardBooking[]
  history: DashboardBooking[]
}) {
  const { t, lang } = useLanguage()
  const my = lang === 'my' ? 'my' : ''
  const [tab, setTab] = useState<'upcoming' | 'history'>('upcoming')

  const list = tab === 'upcoming' ? upcoming : history
  const emptyKey = tab === 'upcoming' ? 'booking.dash.noUpcoming' : 'booking.dash.noHistory'

  return (
    <div className="px-4 pt-4 md:px-0">
      <PointsCard name={name} points={points} />

      <div className="mt-5 border-b border-line">
        <div className="flex gap-6">
          {(['upcoming', 'history'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`border-b-2 pb-2.5 font-display text-[13px] ${my} ${
                tab === k ? 'border-primary font-bold text-ink-primary' : 'border-transparent font-semibold text-ink-muted'
              }`}
            >
              {t(`booking.dash.${k}` as never)}
            </button>
          ))}
          <Link
            href="/rewards"
            className="ml-auto inline-flex items-center gap-1.5 pb-2.5 font-display text-[13px] font-semibold text-primary"
          >
            <Gift size={14} /> <span className={my}>{t('booking.dash.rewards')}</span>
          </Link>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2.5">
        {list.length === 0 ? (
          <div className="fb-card p-8 text-center text-sm text-ink-muted">
            <span className={my}>{t(emptyKey as never)}</span>
          </div>
        ) : (
          list.map((b) => <BookingHistoryCard key={b.id} {...b} />)
        )}
      </div>
    </div>
  )
}
