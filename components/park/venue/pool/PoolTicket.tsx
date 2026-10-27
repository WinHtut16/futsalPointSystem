'use client'

import { Clock } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { HOURS, POOL } from '@/lib/park/content'
import { closedDaysLabel, formatAmount, hoursRange } from '@/lib/park/time'

// Entry price and hours as a ticket stub in the pool hero: two price halves
// over a perforated tear line, hours on the stub. Replaces the separate
// Entry section, so price and hours sit on the first screen.
export default function PoolTicket() {
  const { t, lang } = useLanguage()
  const hours = HOURS.pool
  const closed = hours && closedDaysLabel(hours, t)
  const prices: [string, number][] = [
    [t('park.pool.adult'), POOL.prices.adult],
    [t('park.pool.child'), POOL.prices.child],
  ]

  return (
    <div className="pool-ticket max-w-[440px] text-[#1a1d1f]">
      <p className="px-5 pt-4 text-sm font-semibold text-[#3b4045]">{t('park.pool.ticketLabel')}</p>
      <dl className="grid grid-cols-2 px-5 pb-4 pt-2">
        {prices.map(([label, price], i) => (
          <div key={label} className={i === 1 ? 'border-l border-dashed border-[#cfcfca] pl-5' : 'pr-5'}>
            <dt className="text-[15px] text-[#3b4045]">{label}</dt>
            <dd className="park-display mt-0.5 whitespace-nowrap text-[26px] leading-tight text-[#a8453a]">
              {t('park.pool.perEntry', { price: formatAmount(price, lang) })}
            </dd>
          </div>
        ))}
      </dl>
      {hours && (
        <div className="pool-ticket-stub flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3.5">
          <span className="inline-flex items-center gap-2 font-semibold">
            <Clock size={16} aria-hidden="true" className="text-[#3b4045]" />
            {hoursRange(hours, t, lang)}
          </span>
          {closed && (
            <span className="rounded-full bg-[#a8453a]/10 px-2.5 py-0.5 text-sm font-semibold text-[#8a362c]">{closed}</span>
          )}
          <p className="w-full text-sm leading-snug text-[#3b4045]">{t('park.pool.reEntry')}</p>
        </div>
      )}
    </div>
  )
}
