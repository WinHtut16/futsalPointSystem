'use client'

import { useLanguage } from '@/lib/i18n/LanguageContext'
import { billiardsOpening } from '@/lib/park/content'
import { formatMonth } from '@/lib/park/time'

/** "Opening in November 2026" for billiards; renders nothing once it is open. */
export default function OpeningBadge({ className = '' }: { className?: string }) {
  const { t, lang } = useLanguage()
  const opening = billiardsOpening()
  if (!opening) return null
  return (
    <span className={`inline-flex items-center rounded-full bg-venue-brass px-3 py-1 text-sm font-semibold text-[#1f1214] ${className}`}>
      {t('park.billiards.opening', { month: formatMonth(opening.year, opening.month, lang) })}
    </span>
  )
}
