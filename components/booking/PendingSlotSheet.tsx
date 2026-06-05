'use client'

import { useRef } from 'react'
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

  // Drag-to-dismiss refs
  const dragStartY = useRef<number | null>(null)
  const dragDelta = useRef<number>(0)

  const handleDragStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY
    dragDelta.current = 0
  }

  const handleDragMove = (e: React.TouchEvent) => {
    if (dragStartY.current === null) return
    const scrollContainer = e.currentTarget as HTMLElement
    if (scrollContainer.scrollTop > 0) {
      dragStartY.current = null
      return
    }
    const delta = e.touches[0].clientY - dragStartY.current
    if (delta > 0) dragDelta.current = delta
  }

  const handleDragEnd = () => {
    if (dragDelta.current >= 80) onClose()
    dragStartY.current = null
    dragDelta.current = 0
  }

  if (hour === null) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 cursor-pointer"
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
          p-5 pb-[calc(2rem+env(safe-area-inset-bottom))] md:p-6 md:pb-6
        "
        onTouchStart={handleDragStart}
        onTouchMove={handleDragMove}
        onTouchEnd={handleDragEnd}
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
