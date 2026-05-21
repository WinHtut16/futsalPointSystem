import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import Card from '@/components/ui/Card'
import Link from 'next/link'
import Button from '@/components/ui/Button'
import RewardAdminRow from '@/components/admin/RewardAdminRow'
import type { Reward } from '@/types'

export default async function AdminRewardsPage() {
  const [supabase, profile] = await Promise.all([createClient(), getCurrentUser()])
  const { data: rewards } = await supabase
    .from('rewards')
    .select('*')
    .order('points_cost', { ascending: true })

  const canManage = profile?.role === 'superadmin'

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Rewards</h1>
        {canManage && (
          <Link href="/admin/rewards/new">
            <Button size="sm">+ New Reward</Button>
          </Link>
        )}
      </div>

      <Card className="p-0">
        {rewards && rewards.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {rewards.map((r) => (
              <RewardAdminRow key={r.id} reward={r as Reward} canManage={canManage} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-10">
            No rewards yet.{' '}
            {canManage && (
              <Link href="/admin/rewards/new" className="text-brand-600 hover:underline">
                Create one
              </Link>
            )}
          </p>
        )}
      </Card>
    </div>
  )
}
