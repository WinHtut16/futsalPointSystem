import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import AdminShell from '@/components/admin/AdminShell'
import { PendingRedemptionsProvider } from '@/contexts/PendingRedemptionsContext'
import { PendingBookingsProvider } from '@/contexts/PendingBookingsContext'
import PendingSoundAlert from '@/components/admin/PendingSoundAlert'
import PendingBookingsSoundAlert from '@/components/admin/PendingBookingsSoundAlert'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentUser()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'superadmin')) {
    redirect('/admin/login')
  }

  const supabase = await createClient()
  const svc = createServiceClient()
  const [{ count: initialPendingCount }, { count: initialPendingBookingsCount }] = await Promise.all([
    supabase
      .from('redemption_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
    svc
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
  ])

  return (
    <PendingRedemptionsProvider initialCount={initialPendingCount ?? 0}>
      <PendingBookingsProvider initialCount={initialPendingBookingsCount ?? 0}>
        <AdminShell role={profile.role} username={profile.username}>
          {children}
        </AdminShell>
        <PendingSoundAlert />
        <PendingBookingsSoundAlert />
      </PendingBookingsProvider>
    </PendingRedemptionsProvider>
  )
}
