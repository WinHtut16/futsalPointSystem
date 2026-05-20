import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import RewardCard from '@/components/customer/RewardCard'
import type { Reward } from '@/types'

export default async function RewardsPage() {
  const profile = await getCurrentUser()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  const { data: rewards } = await supabase
    .from('rewards')
    .select('*')
    .eq('is_active', true)
    .order('points_cost', { ascending: true })

  return (
    <div className="px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Rewards</h1>
        <span className="text-sm text-gray-500 bg-white border border-gray-200 px-2 py-1 rounded-lg font-semibold text-brand-600">
          {profile.total_points} pts
        </span>
      </div>

      {rewards && rewards.length > 0 ? (
        <div className="grid grid-cols-1 gap-3">
          {rewards.map((reward) => (
            <RewardCard
              key={reward.id}
              reward={reward as Reward}
              userPoints={profile.total_points}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🎁</p>
          <p className="text-sm">No rewards available yet.</p>
          <p className="text-xs mt-1">Check back soon!</p>
        </div>
      )}
    </div>
  )
}
