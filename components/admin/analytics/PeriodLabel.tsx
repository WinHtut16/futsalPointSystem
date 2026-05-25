'use client'

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

/** Renders the selected period as an uppercase "MONTH YEAR" label. */
export default function PeriodLabel({ month, year }: { month: number; year: number }) {
  const { t } = useLanguage()
  return <>{`${t(MONTH_KEYS[month - 1])} ${year}`.toUpperCase()}</>
}
