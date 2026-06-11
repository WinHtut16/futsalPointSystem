'use client'

import { useState } from 'react'
import { Clock, X, Receipt, Calendar, Wallet, Hash } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import Modal from '@/components/ui/Modal'
import ConfirmModal from '@/components/ui/ConfirmModal'

export type BookingStatus = 'confirmed' | 'pending' | 'closed' | 'cancelled'

const chip: Record<BookingStatus, string> = {
  confirmed: 'pill-available',
  pending: 'pill-pending',
  closed: 'pill-closed',
  cancelled: 'pill-booked',
}

const COMPLETED_CHIP = 'pill-closed'

export default function BookingHistoryCard({
  id,
  status,
  dateLabel,
  timeLabel,
  refCode,
  deposit,
  canCancel,
  isPast = false,
}: {
  id: string
  status: BookingStatus
  dateLabel: string
  timeLabel: string
  refCode: string
  deposit: string
  canCancel: boolean
  isPast?: boolean
}) {
  const { t, lang } = useLanguage()
  const my = lang === 'my' ? 'my' : ''
  const [cancelled, setCancelled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const effective: BookingStatus = cancelled ? 'cancelled' : status
  const showCompleted = isPast && effective === 'confirmed'

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
    <>
      <div className="fb-card p-4" style={{ opacity: effective === 'cancelled' ? 0.7 : 1 }}>
        <div className="flex items-start justify-between">
          <div>
            <div className={`font-display text-[15px] font-bold text-ink-primary ${my}`}>{dateLabel}</div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted">
              <Clock size={12} /> <span className="font-fbmono">{timeLabel}</span>
            </div>
          </div>
          <span className={`fb-chip ${showCompleted ? COMPLETED_CHIP : chip[effective]} px-2.5 py-1`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            <span className={my}>{showCompleted ? t('booking.status.completed' as never) : t(`booking.status.${effective}` as never)}</span>
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

        {isPast || effective === 'cancelled' || effective === 'closed' ? (
          <button
            type="button"
            onClick={() => setShowDetails(true)}
            className="fb-btn fb-btn-ghost mt-3 w-full !py-2.5 !text-xs"
          >
            <Receipt size={13} /> <span className={my}>{t('booking.dash.details')}</span>
          </button>
        ) : (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => { if (canCancel && !busy) setShowCancelConfirm(true) }}
              disabled={!canCancel || busy}
              title={!canCancel ? t('booking.dash.cannotCancel') : ''}
              className="fb-btn fb-btn-ghost flex-1 !py-2.5 !text-xs"
              style={{ opacity: canCancel ? 1 : 0.5, cursor: canCancel ? 'pointer' : 'not-allowed' }}
            >
              <X size={13} /> <span className={my}>{t('common.cancel')}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowDetails(true)}
              className="fb-btn fb-btn-ghost flex-1 !py-2.5 !text-xs"
            >
              <Receipt size={13} /> <span className={my}>{t('booking.dash.details')}</span>
            </button>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        onConfirm={() => { setShowCancelConfirm(false); cancel() }}
        title="Cancel your booking"
        message="Are you sure you want to cancel this booking? Please contact us if you need help."
        confirmLabel={t('common.cancel')}
        cancelLabel={t('booking.admin.keep' as never) || 'Keep booking'}
        variant="warning"
        isLoading={busy}
      />

      <Modal
        open={showDetails}
        onClose={() => setShowDetails(false)}
        title={t('booking.dash.details')}
      >
        <div className="flex flex-col gap-4">
          <DetailRow icon={<Hash size={14} />} label={t('booking.confirm.ref')} my={my}>
            <span className="font-fbmono text-[15px] font-bold tracking-wider text-ink-primary">{refCode}</span>
          </DetailRow>
          <hr className="fb-divider" />
          <DetailRow icon={<Calendar size={14} />} label={t('booking.summary.date')} my={my}>
            <span className={`font-display text-sm font-semibold text-ink-primary ${my}`}>{dateLabel}</span>
          </DetailRow>
          <DetailRow icon={<Clock size={14} />} label={t('booking.confirm.time')} my={my}>
            <span className="font-fbmono text-sm font-semibold text-ink-primary">{timeLabel}</span>
          </DetailRow>
          <DetailRow icon={<Wallet size={14} />} label={t('booking.confirm.deposit')} my={my}>
            <span className="font-display text-sm font-semibold text-ink-primary">{deposit}</span>
          </DetailRow>
          <hr className="fb-divider" />
          <div className="flex items-center justify-between">
            <span className={`text-[12px] text-ink-muted ${my}`}>{t('booking.dash.status')}</span>
            <span className={`fb-chip ${chip[effective]} px-2.5 py-1`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              <span className={my}>{t(`booking.status.${effective}` as never)}</span>
            </span>
          </div>
        </div>
      </Modal>
    </>
  )
}

function DetailRow({
  icon, label, my, children,
}: {
  icon: React.ReactNode; label: string; my: string; children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={`inline-flex items-center gap-2 text-[12px] text-ink-muted ${my}`}>
        {icon} {label}
      </span>
      {children}
    </div>
  )
}
