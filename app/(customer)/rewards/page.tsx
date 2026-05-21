import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import RewardsGrid from '@/components/customer/RewardsGrid'
import T from '@/components/ui/T'
import type { Reward } from '@/types'

export default async function RewardsPage() {
  const profile = await getCurrentUser()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  const [{ data: rewards }, { data: pendingRequests }] = await Promise.all([
    supabase
      .from('rewards')
      .select('*')
      .eq('is_active', true)
      .order('points_cost', { ascending: true }),
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
        <span className="text-sm text-gray-500 bg-white border border-gray-200 px-2 py-1 rounded-lg font-semibold text-brand-600">
          {profile.total_points} <T k="rewards.pts" />
        </span>
      </div>

      {rewards && rewards.length > 0 ? (
        <RewardsGrid
          rewards={rewards as Reward[]}
          userId={profile.id}
          userPoints={profile.total_points}
          initialPendingMap={initialPendingMap}
        />
      ) : (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🎁</p>
          <p className="text-sm"><T k="rewards.noRewards" /></p>
          <p className="text-xs mt-1"><T k="rewards.checkBack" /></p>
        </div>
      )}
    </div>
  )
}
