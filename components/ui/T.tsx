'use client'

import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { TranslationKey } from '@/lib/i18n/translations'

export default function T({
  k,
  vars,
}: {
  k: TranslationKey
  vars?: Record<string, string | number>
}) {
  const { t } = useLanguage()
  return <>{t(k, vars)}</>
}
