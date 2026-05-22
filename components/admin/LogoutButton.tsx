'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function LogoutButton() {
  const router = useRouter()
  const { t } = useLanguage()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/admin/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      className="text-xs text-gray-400 hover:text-white transition-colors"
    >
      {t('admin.logout')}
    </button>
  )
}
