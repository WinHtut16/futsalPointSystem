'use client'

import { useLanguage } from '@/lib/i18n/LanguageContext'

// First focusable element on every park page; jumps keyboard users past the nav.
export default function SkipLink() {
  const { t } = useLanguage()
  return (
    <a href="#main" className="park-skip">
      {t('park.skip')}
    </a>
  )
}
