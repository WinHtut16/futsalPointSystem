'use client'

import { AlertTriangle } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { formatHourRange } from '@/lib/booking'

export default function PendingSlotSheet({
  hour,
  onConfirm,
  onClose,
}: {
  hour: number | null
  onConfirm: () => void
  onClose: () => void
}) {
  const { t, lang } = useLanguage()
  const my = lang === 'my' ? 'my' : ''

  if (hour === null) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom sheet on mobile, centered dialog on md+ */}
      <div
        role="dialog"
        aria-modal="true"
        className="
          fixed z-50 left-0 right-0 bottom-0
          md:left-1/2 md:right-auto md:bottom-auto md:top-1/2
          md:-translate-x-1/2 md:-translate-y-1/2
          w-full md:w-[420px]
          rounded-t-[var(--r-xl)] md:rounded-[var(--r-xl)]
          bg-surface shadow-fb-md
          p-5 pb-8 md:p-6 md:pb-6
        "
      >
        {/* Handle (mobile only) */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line md:hidden" />

        <div className="flex items-center gap-2.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ background: 'var(--color-slot-pending-bg)' }}
          >
            <AlertTriangle size={18} style={{ color: 'var(--color-slot-pending)' }} />
          </span>
          <div>
            <div className={`font-display text-sm font-bold text-ink-primary ${my}`}>
              {t('booking.pending.sheetTitle')}
            </div>
            <div className="font-fbmono text-[11px] text-ink-muted">
              {formatHourRange(hour)}
            </div>
          </div>
        </div>

        <p className={`mt-4 text-sm leading-relaxed text-ink-secondary ${my}`}>
          {t('booking.pending.sheetBody')}
        </p>

        <div className="mt-5 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onConfirm}
            className="fb-btn fb-btn-primary w-full !py-3.5"
          >
            <span className={my}>{t('booking.pending.request')}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="fb-btn w-full !py-3 border border-line text-ink-secondary hover:bg-surface-alt"
          >
            <span className={my}>{t('booking.pending.cancel')}</span>
          </button>
        </div>
      </div>
    </>
  )
}
