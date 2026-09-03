'use client'

import { Toaster } from 'sonner'
import { LanguageProvider } from '@/lib/i18n/LanguageContext'
import type { Language } from '@/lib/i18n'

export default function Providers({
  children,
  initialLang,
}: {
  children: React.ReactNode
  initialLang?: Language
}) {
  return (
    <LanguageProvider initialLang={initialLang}>
      {children}
      {/* Shared toast placement — see DESIGN.md. */}
      <Toaster position="bottom-center" />
    </LanguageProvider>
  )
}
