import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { getActiveRewards } from '@/lib/cached-queries'
import { redirect } from 'next/navigation'
import { Gift } from 'lucide-react'
import RewardsGrid from '@/components/customer/RewardsGrid'
import RealtimePointsBadge from '@/components/customer/RealtimePointsBadge'
import T from '@/components/ui/T'
import type { Reward } from '@/types'

export default async function RewardsPage() {
  const profile = await getCurrentUser()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  const [rewards, { data: pendingRequests }] = await Promise.all([
    getActiveRewards(),
    supabase
      .from('redemption_requests')
      .select('id, reward_id')
      .eq('customer_id', profile.id)
      .eq('status', 'pending'),
  ])

  const initialPendingMap: Record<string, string> = {}
  pendingRequests?.forEach((r) => { initialPendingMap[r.reward_id] = r.id })

  return (
    <div className="px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900"><T k="rewards.title" /></h1>
        <RealtimePointsBadge userId={profile.id} initialPoints={profile.total_points} />
      </div>

      {rewards.length > 0 ? (
        <RewardsGrid
          rewards={rewards}
          userId={profile.id}
          userPoints={profile.total_points}
          initialPendingMap={initialPendingMap}
        />
      ) : (
        <div className="text-center py-16 text-gray-400">
          <Gift className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-sm"><T k="rewards.noRewards" /></p>
          <p className="text-xs mt-1"><T k="rewards.checkBack" /></p>
        </div>
      )}
    </div>
  )
}
