'use client'

import { useLanguage } from '@/lib/i18n/LanguageContext'
import { TIER_PRICE, type PriceTier } from '@/lib/booking'

const TIERS: { tier: PriceTier; labelKey: string; time: string }[] = [
  { tier: 'morning', labelKey: 'booking.pricing.weekdayAm', time: '06:00 – 14:00' },
  { tier: 'evening', labelKey: 'booking.pricing.weekdayPm', time: '14:00 – 22:00' },
  { tier: 'weekend', labelKey: 'booking.pricing.weekend', time: 'allDay' },
]

const tierVar: Record<PriceTier, string> = {
  morning: 'var(--color-price-morning)',
  evening: 'var(--color-price-evening)',
  weekend: 'var(--color-price-weekend)',
}

function money(n: number) {
  return n.toLocaleString('en-US')
}

// Compact legend (3 cards) used on the booking page above the calendar.
export function PricingLegend() {
  const { t, lang } = useLanguage()
  const my = lang === 'my' ? 'my' : ''
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {TIERS.map(({ tier, labelKey, time }) => (
        <div
          key={tier}
          className="fb-card px-3 py-2.5"
          style={{ borderLeft: `4px solid ${tierVar[tier]}` }}
        >
          <div className={`font-display text-[11px] font-bold text-ink-primary ${my}`}>
            {t(labelKey as never)}
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="font-fbmono text-[10px] text-ink-muted">
              {time === 'allDay' ? t('booking.pricing.allDay') : time}
            </span>
            <span className="font-display text-[13px] font-bold text-ink-primary">
              {money(TIER_PRICE[tier])}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// Full pricing table (rows) used on the homepage.
export function PricingTable() {
  const { t, lang } = useLanguage()
  const my = lang === 'my' ? 'my' : ''
  return (
    <div className="fb-card overflow-hidden">
      {TIERS.map(({ tier, labelKey, time }, i) => (
        <div
          key={tier}
          className={`flex items-center justify-between px-4 py-3.5 ${
            i < 2 ? 'border-b border-line' : ''
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className="h-9 w-1 rounded-sm"
              style={{ background: tierVar[tier] }}
            />
            <div>
              <div className={`font-display text-[13px] font-bold text-ink-primary ${my}`}>
                {t(labelKey as never)}
              </div>
              <div className="mt-0.5 font-fbmono text-[11px] text-ink-muted">
                {time === 'allDay' ? t('booking.pricing.allDay') : time}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-[17px] font-extrabold text-ink-primary">
              {money(TIER_PRICE[tier])}
            </div>
            <div className={`font-display text-[10px] text-ink-muted ${my}`}>
              {t('booking.pricing.perHour')}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
