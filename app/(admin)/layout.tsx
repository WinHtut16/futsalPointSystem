import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import AdminShell from '@/components/admin/AdminShell'
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
      <AdminShell role={profile.role} username={profile.username}>
        {children}
      </AdminShell>
      <PendingSoundAlert />
    </PendingRedemptionsProvider>
  )
}
