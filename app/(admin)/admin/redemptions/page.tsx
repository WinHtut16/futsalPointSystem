import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import RedemptionsList from '@/components/admin/RedemptionsList'
import T from '@/components/ui/T'
import type { RedemptionRequest } from '@/types'

export default async function AdminRedemptionsPage() {
  const [supabase, profile] = await Promise.all([createClient(), getCurrentUser()])

  const SELECT_QUERY =
    '*, reward:rewards(name, points_cost), customer:profiles!customer_id(username, phone, total_points)'

  const [{ data: pending }, { data: history }] = await Promise.all([
    supabase
      .from('redemption_requests')
      .select(SELECT_QUERY)
      .eq('status', 'pending')
      .order('requested_at', { ascending: true }),
    supabase
      .from('redemption_requests')
      .select(SELECT_QUERY)
      .in('status', ['approved', 'rejected', 'cancelled'])
      .order('resolved_at', { ascending: false })
      .limit(200),
  ])

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">
        <T k="admin.pageHeadingRedemptions" />
      </h1>
      <RedemptionsList
        initialRequests={(pending ?? []) as RedemptionRequest[]}
        initialHistory={(history ?? []) as RedemptionRequest[]}
        isSuperAdmin={profile?.role === 'superadmin'}
      />
    </div>
  )
}
