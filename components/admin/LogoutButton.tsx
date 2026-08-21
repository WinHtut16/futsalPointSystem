'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function LogoutButton() {
  const router = useRouter()
  const { t } = useLanguage()

  async function handleLogout() {
    // Server-side sign-out (see app/api/auth/logout/route.ts) — reliable even
    // when the browser's own direct connection to Supabase is blocked.
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    router.push('/admin/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 hover:border-red-300"
    >
      <LogOut size={13} strokeWidth={2} />
      {t('admin.logout')}
    </button>
  )
}
