'use client'

import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { SlotState } from '@/lib/booking'

const STATES: SlotState[] = ['available', 'pending', 'booked', 'closed']

export default function SlotLegend({ dense = false }: { dense?: boolean }) {
  const { t, lang } = useLanguage()
  const my = lang === 'my' ? 'my' : ''
  return (
    <div
      className={`flex flex-wrap items-center rounded-[var(--r-md)] border border-line bg-surface-alt ${
        dense ? 'gap-2 px-2.5 py-2' : 'gap-3 px-3.5 py-3'
      }`}
    >
      {STATES.map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5 font-display text-[11px] font-semibold">
          <span className={`pill-${s} h-3.5 w-3.5 rounded`} style={{ border: '1.5px solid currentColor' }} />
          <span className={`text-ink ${my}`}>
            {t(`booking.slot.${s}` as never)}
            {s === 'pending' && (
              <span className="ml-1 font-normal opacity-70">
                — {t('booking.slot.pendingHint')}
              </span>
            )}
          </span>
        </span>
      ))}
    </div>
  )
}
