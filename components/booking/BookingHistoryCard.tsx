'use client'

import { useState } from 'react'
import { Clock, X, Receipt } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export type BookingStatus = 'confirmed' | 'pending' | 'closed' | 'cancelled'

const chip: Record<BookingStatus, string> = {
  confirmed: 'pill-available',
  pending: 'pill-pending',
  closed: 'pill-closed',
  cancelled: 'pill-booked',
}

export default function BookingHistoryCard({
  id,
  status,
  dateLabel,
  timeLabel,
  refCode,
  deposit,
  canCancel,
}: {
  id: string
  status: BookingStatus
  dateLabel: string
  timeLabel: string
  refCode: string
  deposit: string
  canCancel: boolean
}) {
  const { t, lang } = useLanguage()
  const my = lang === 'my' ? 'my' : ''
  const [cancelled, setCancelled] = useState(false)
  const [busy, setBusy] = useState(false)
  const effective: BookingStatus = cancelled ? 'cancelled' : status

  async function cancel() {
    if (!canCancel || busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      })
      if (res.ok) setCancelled(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fb-card p-4" style={{ opacity: effective === 'cancelled' ? 0.7 : 1 }}>
      <div className="flex items-start justify-between">
        <div>
          <div className={`font-display text-[15px] font-bold text-ink-primary ${my}`}>{dateLabel}</div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted">
            <Clock size={12} /> <span className="font-fbmono">{timeLabel}</span>
          </div>
        </div>
        <span className={`fb-chip ${chip[effective]} px-2.5 py-1`}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          <span className={my}>{t(`booking.status.${effective}` as never)}</span>
        </span>
      </div>

      <hr className="fb-divider my-3" />

      <div className="flex items-center justify-between">
        <div className="font-fbmono text-[11px] text-ink-muted">{refCode}</div>
        <div className="text-xs text-ink-muted">
          <span className={my}>{t('booking.confirm.deposit')}</span>{' '}
          <strong className="font-display text-ink-primary">{deposit}</strong>
        </div>
      </div>

      {effective !== 'cancelled' && effective !== 'closed' && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={cancel}
            disabled={!canCancel || busy}
            title={!canCancel ? t('booking.dash.cannotCancel') : ''}
            className="fb-btn fb-btn-ghost flex-1 !py-2.5 !text-xs"
            style={{ opacity: canCancel ? 1 : 0.5, cursor: canCancel ? 'pointer' : 'not-allowed' }}
          >
            <X size={13} /> <span className={my}>{t('common.cancel')}</span>
          </button>
          <button type="button" className="fb-btn fb-btn-ghost flex-1 !py-2.5 !text-xs">
            <Receipt size={13} /> <span className={my}>{t('booking.dash.details')}</span>
          </button>
        </div>
      )}
    </div>
  )
}
