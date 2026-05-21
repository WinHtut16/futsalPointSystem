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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Redemption Requests</h1>
        {list.length > 0 && (
          <span className="bg-yellow-100 text-yellow-700 text-sm font-semibold px-2.5 py-0.5 rounded-full">
            {list.length} pending
          </span>
        )}
      </div>

      <RedemptionsList requests={list} />
    </div>
  )
}
