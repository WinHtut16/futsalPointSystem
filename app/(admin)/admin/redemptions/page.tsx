import { createClient } from '@/lib/supabase/server'
import RedemptionsList from '@/components/admin/RedemptionsList'
import type { RedemptionRequest } from '@/types'

export default async function AdminRedemptionsPage() {
  const supabase = await createClient()
  const { data: requests } = await supabase
    .from('redemption_requests')
    .select(
      '*, reward:rewards(name, points_cost), customer:profiles!customer_id(username, phone, total_points)'
    )
    .eq('status', 'pending')
    .order('requested_at', { ascending: true })

  const list = (requests ?? []) as RedemptionRequest[]

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Redemption Requests</h1>
      <RedemptionsList initialRequests={list} />
    </div>
  )
}
