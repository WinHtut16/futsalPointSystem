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
  selectedAsOverride = false,
  maxReached = false,
  onClick,
  onPendingClick,
}: {
  hourStart: number
  price: number
  state: SlotState
  tier: PriceTier
  selected?: boolean
  selectedAsOverride?: boolean
  maxReached?: boolean
  onClick?: () => void
  onPendingClick?: () => void
}) {
  const { t, lang } = useLanguage()
  const my = lang === 'my' ? 'my' : ''

  const isPending = state === 'pending'
  const isClickablePending = isPending && !!onPendingClick && !selected
  const disabled = selected
    ? false
    : isPending
    ? !isClickablePending
    : state !== 'available' || maxReached

  const visualState = maxReached && state === 'available' ? 'closed' : state

  // Override-selected: amber border + tint instead of primary green
  const overrideBg = 'oklch(0.97 0.03 78)'
  const overrideBorder = 'var(--color-slot-pending)'
  const overrideText = 'oklch(0.50 0.13 78)'

  const borderColor = selectedAsOverride
    ? overrideBorder
    : selected
    ? 'var(--color-primary)'
    : 'currentColor'
  const background = selectedAsOverride
    ? overrideBg
    : selected
    ? 'var(--color-primary)'
    : undefined
  const color = selectedAsOverride
    ? overrideText
    : selected
    ? 'var(--color-on-primary)'
    : undefined

  const handleClick = isClickablePending ? onPendingClick : disabled ? undefined : onClick

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled && !isClickablePending}
      className={`pill-${visualState} relative flex items-center justify-between rounded-[var(--r-md)] px-3.5 py-3 text-left`}
      style={{
        border: `1.5px solid ${borderColor}`,
        background,
        color,
        cursor: isClickablePending || (!disabled && onClick) ? 'pointer' : 'not-allowed',
        opacity: (state === 'closed' || (maxReached && !isClickablePending)) ? 0.85 : 1,
      }}
      aria-pressed={selected || selectedAsOverride}
    >
      <span
        className="absolute bottom-2 left-0 top-2 w-[3px] rounded-sm"
        style={{
          background: selectedAsOverride
            ? overrideBorder
            : selected
            ? 'var(--color-on-primary)'
            : tierVar[tier],
          opacity: 0.85,
        }}
      />
      <span className="flex flex-col gap-0.5 pl-2">
        <span
          className="font-display text-sm font-bold leading-tight"
          style={{
            color: selectedAsOverride
              ? overrideText
              : selected
              ? 'var(--color-on-primary)'
              : 'var(--color-text-primary)',
          }}
        >
          {formatHourRange(hourStart)}
        </span>
        <span className="font-fbmono text-[11px] opacity-85">{price.toLocaleString('en-US')} MMK</span>
      </span>
      {(selected || selectedAsOverride) ? (
        <Check size={16} strokeWidth={2.4} />
      ) : (
        <span className={`font-display text-[10px] font-bold uppercase tracking-wide opacity-90 ${my}`}>
          {maxReached ? 'Max' : t(`booking.slot.${state}` as never)}
        </span>
      )}
    </button>
  )
}
