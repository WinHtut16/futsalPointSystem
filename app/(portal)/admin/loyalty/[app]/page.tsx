import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAppRole } from '@/lib/apps.server'
import { BUSINESS_REDEMPTION_SELECT, isLoyaltyApp, loyaltyApi, withBusinessBalance } from '@/lib/loyalty'
import RedemptionsList from '@/components/admin/RedemptionsList'

export const dynamic = 'force-dynamic'

/** Pending and resolved redemption requests for one business. */
export default async function LoyaltyRequestsPage({ params }: { params: Promise<{ app: string }> }) {
  const { app } = await params
  if (!isLoyaltyApp(app)) notFound()

  const supabase = await createClient()
  const [{ data: pending }, { data: history }, role] = await Promise.all([
    supabase
      .from('redemption_requests')
      .select(BUSINESS_REDEMPTION_SELECT)
      .eq('app', app)
      .eq('status', 'pending')
      .order('requested_at', { ascending: true }),
    supabase
      .from('redemption_requests')
      .select(BUSINESS_REDEMPTION_SELECT)
      .eq('app', app)
      .in('status', ['approved', 'rejected', 'cancelled'])
      .order('resolved_at', { ascending: false })
      .limit(200),
    getAppRole(app),
  ])

  return (
    <RedemptionsList
      initialRequests={withBusinessBalance(pending, app)}
      initialHistory={withBusinessBalance(history, app)}
      isSuperAdmin={role === 'superadmin'}
      app={app}
      actionBase={loyaltyApi(app, '/redemptions')}
      deleteUrl={loyaltyApi(app, '/redemptions/delete')}
    />
  )
}
