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
  const todayMM = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Yangon' }).format(new Date())

  const nowParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Yangon',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const nowHourFrac =
    parseInt(nowParts.find((p) => p.type === 'hour')?.value ?? '0', 10) +
    parseInt(nowParts.find((p) => p.type === 'minute')?.value ?? '0', 10) / 60

  const [{ count: initialPendingCount }, { count: futureBookingsCount }, todayBookingsResult] =
    await Promise.all([
      supabase
        .from('redemption_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),
      svc
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .eq('deposit_received', false)
        .gt('booking_date', todayMM),
      svc
        .from('bookings')
        .select('id, booking_slots(hour_start)')
        .eq('status', 'pending')
        .eq('deposit_received', false)
        .eq('booking_date', todayMM),
    ])

  const todayActiveCount = (
    (todayBookingsResult.data ?? []) as { id: string; booking_slots: { hour_start: number }[] }[]
  ).filter((b) => {
    const slots = b.booking_slots ?? []
    return slots.length === 0 || slots.some((s) => s.hour_start + 1 > nowHourFrac)
  }).length

  const initialPendingBookingsCount = (futureBookingsCount ?? 0) + todayActiveCount

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
