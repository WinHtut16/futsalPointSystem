import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import Card from '@/components/ui/Card'
import Link from 'next/link'
import Button from '@/components/ui/Button'
import RewardAdminRow from '@/components/admin/RewardAdminRow'
import T from '@/components/ui/T'
import type { Reward } from '@/types'

export default async function AdminRewardsPage() {
  const [supabase, profile] = await Promise.all([createClient(), getCurrentUser()])
  const { data: rewards } = await supabase
    .from('rewards')
    .select('*')
    .order('points_cost', { ascending: true })

  const canManage = profile?.role === 'superadmin'
  const canToggle = profile?.role === 'admin' || profile?.role === 'superadmin'

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900"><T k="admin.pageHeadingRewards" /></h1>
        {canManage && (
          <Link href="/admin/rewards/new">
            <Button size="sm"><T k="admin.newReward" /></Button>
          </Link>
        )}
      </div>

      <Card className="p-0">
        {rewards && rewards.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {rewards.map((r) => (
              <RewardAdminRow key={r.id} reward={r as Reward} canToggle={canToggle} canManage={canManage} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-10">
            <T k="admin.noRewards" />{' '}
            {canManage && (
              <Link href="/admin/rewards/new" className="text-brand-600 hover:underline">
                <T k="admin.createOne" />
              </Link>
            )}
          </p>
        )}
      </Card>
    </div>
  )
}
