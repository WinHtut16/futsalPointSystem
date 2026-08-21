'use client'

import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function LogoutButton() {
  const router = useRouter()
  const { t } = useLanguage()

  async function handleLogout() {
    // Server-side sign-out (see app/api/auth/logout/route.ts) — reliable even
    // when the browser's own direct connection to Supabase is blocked.
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    router.push('/?logged_out=1')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      className="text-xs text-brand-200 hover:text-white transition-colors"
    >
      {t('nav.logout')}
    </button>
  )
}
