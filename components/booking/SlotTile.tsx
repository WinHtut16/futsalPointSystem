'use client'

import { Check } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { formatHourRange, type PriceTier, type SlotState } from '@/lib/booking'

const tierVar: Record<PriceTier, string> = {
  morning: 'var(--color-price-morning)',
  evening: 'var(--color-price-evening)',
  weekend: 'var(--color-price-weekend)',
}

export default function SlotTile({
  hourStart,
  price,
  state,
  tier,
  selected = false,
  onClick,
}: {
  hourStart: number
  price: number
  state: SlotState
  tier: PriceTier
  selected?: boolean
  onClick?: () => void
}) {
  const { t, lang } = useLanguage()
  const my = lang === 'my' ? 'my' : ''
  const disabled = state !== 'available'

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`pill-${state} relative flex items-center justify-between rounded-[var(--r-md)] px-3.5 py-3 text-left`}
      style={{
        border: `1.5px solid ${selected ? 'var(--color-primary)' : 'currentColor'}`,
        background: selected ? 'var(--color-primary)' : undefined,
        color: selected ? 'var(--color-on-primary)' : undefined,
        cursor: state === 'available' ? 'pointer' : 'not-allowed',
        opacity: state === 'closed' ? 0.85 : 1,
      }}
      aria-pressed={selected}
    >
      <span
        className="absolute bottom-2 left-0 top-2 w-[3px] rounded-sm"
        style={{ background: selected ? 'var(--color-on-primary)' : tierVar[tier], opacity: 0.85 }}
      />
      <span className="flex flex-col gap-0.5 pl-2">
        <span
          className="font-display text-sm font-bold leading-tight"
          style={{ color: selected ? 'var(--color-on-primary)' : 'var(--color-text-primary)' }}
        >
          {formatHourRange(hourStart)}
        </span>
        <span className="font-fbmono text-[11px] opacity-85">{price.toLocaleString('en-US')} MMK</span>
      </span>
      {selected ? (
        <Check size={16} strokeWidth={2.4} />
      ) : (
        <span className={`font-display text-[10px] font-bold uppercase tracking-wide opacity-90 ${my}`}>
          {t(`booking.slot.${state}` as never)}
        </span>
      )}
    </button>
  )
}
