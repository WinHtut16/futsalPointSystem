'use client'

import { LanguageProvider } from '@/lib/i18n/LanguageContext'
import type { Language } from '@/lib/i18n'

export default function Providers({
  children,
  initialLang,
}: {
  children: React.ReactNode
  initialLang?: Language
}) {
  return <LanguageProvider initialLang={initialLang}>{children}</LanguageProvider>
}
