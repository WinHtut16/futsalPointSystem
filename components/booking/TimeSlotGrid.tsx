'use client'

import { AlertTriangle } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { PriceTier, SlotState } from '@/lib/booking'
import SlotTile from './SlotTile'

export type SlotView = {
  hourStart: number
  price: number
  state: SlotState
  tier: PriceTier
}

export default function TimeSlotGrid({
  slots,
  selected,
  onToggle,
  atMax = false,
}: {
  slots: SlotView[]
  selected: number[]
  onToggle: (hourStart: number) => void
  atMax?: boolean
}) {
  const { t, lang } = useLanguage()
  const my = lang === 'my' ? 'my' : ''

  return (
    <div>
      {atMax && (
        <div className="mb-3 flex items-start gap-2.5 rounded-[var(--r-md)] border border-slot-pending bg-slot-pending-bg p-3.5">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-slot-pending" />
          <div>
            <div className={`font-display text-xs font-bold text-slot-pending ${my}`}>
              {t('booking.book.maxNoticeTitle')}
            </div>
            <div className={`mt-1 text-[11px] leading-snug text-ink ${my}`}>
              {t('booking.book.maxNoticeBody')}
              <span className="font-fbmono font-bold">+95 9 797 272000</span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {slots.map((s) => {
          const isSelected = selected.includes(s.hourStart)
          const tileMaxReached = atMax && s.state === 'available' && !isSelected
          return (
            <SlotTile
              key={s.hourStart}
              hourStart={s.hourStart}
              price={s.price}
              state={s.state}
              tier={s.tier}
              selected={isSelected}
              maxReached={tileMaxReached}
              onClick={() => onToggle(s.hourStart)}
            />
          )
        })}
      </div>
    </div>
  )
}
