'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { TranslationKey } from '@/lib/i18n'

const MONTH_KEYS: TranslationKey[] = [
  'admin.monthJan',
  'admin.monthFeb',
  'admin.monthMar',
  'admin.monthApr',
  'admin.monthMay',
  'admin.monthJun',
  'admin.monthJul',
  'admin.monthAug',
  'admin.monthSep',
  'admin.monthOct',
  'admin.monthNov',
  'admin.monthDec',
]

interface PeriodSelectorProps {
  month: number // 1–12
  year: number
  minYear: number
  maxYear: number
  /** When provided, called instead of the built-in router.replace navigation. */
  onNavigate?: (month: number, year: number) => void
}

export default function PeriodSelector({
  month,
  year,
  minYear,
  maxYear,
  onNavigate,
}: PeriodSelectorProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { t } = useLanguage()

  const years: number[] = []
  for (let y = maxYear; y >= minYear; y--) years.push(y)

  function update(nextMonth: number, nextYear: number) {
    if (onNavigate) {
      onNavigate(nextMonth, nextYear)
    } else {
      router.replace(`${pathname}?month=${nextMonth}&year=${nextYear}`, { scroll: false })
    }
  }

  const selectClass =
    'rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm text-gray-800 ' +
    'focus:outline-none focus:ring-2 focus:ring-brand-500/40'

  return (
    <div className="flex items-center gap-2">
      <label className="sr-only">{t('admin.periodMonth')}</label>
      <select
        aria-label={t('admin.periodMonth')}
        className={selectClass}
        value={month}
        onChange={(e) => update(Number(e.target.value), year)}
      >
        {MONTH_KEYS.map((key, i) => (
          <option key={key} value={i + 1}>
            {t(key)}
          </option>
        ))}
      </select>
      <label className="sr-only">{t('admin.periodYear')}</label>
      <select
        aria-label={t('admin.periodYear')}
        className={selectClass}
        value={year}
        onChange={(e) => update(month, Number(e.target.value))}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  )
}
