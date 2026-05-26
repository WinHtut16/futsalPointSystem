import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import AdminNav from '@/components/admin/AdminNav'
import LogoutButton from '@/components/admin/LogoutButton'
import LanguageToggle from '@/components/ui/LanguageToggle'
import { PendingRedemptionsProvider } from '@/contexts/PendingRedemptionsContext'
import PendingSoundAlert from '@/components/admin/PendingSoundAlert'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentUser()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'superadmin')) {
    redirect('/admin/login')
  }

  const supabase = await createClient()
  const { count: initialPendingCount } = await supabase
    .from('redemption_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  return (
    <PendingRedemptionsProvider initialCount={initialPendingCount ?? 0}>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-gray-900 text-white px-4 py-2 flex items-center justify-between shadow">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo_black.jpg" alt="Mya Thida" className="h-10 w-10 rounded-lg object-contain" />
            <span className="font-bold text-base leading-tight">
              Mya Thida
              <br />
              <span className="text-gray-400 text-xs font-normal">Admin Panel</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <LanguageToggle variant="dark" />
            <div className="text-right">
              <p className="text-sm text-gray-200">{profile.username}</p>
              <p className="text-xs text-gray-400 capitalize">{profile.role}</p>
            </div>
            <LogoutButton />
          </div>
        </header>
        <AdminNav role={profile.role} />
        <PendingSoundAlert />
        <main className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full">{children}</main>
      </div>
    </PendingRedemptionsProvider>
  )
}
