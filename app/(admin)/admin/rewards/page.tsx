import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import Link from 'next/link'
import Button from '@/components/ui/Button'
import RewardAdminRow from '@/components/admin/RewardAdminRow'
import T from '@/components/ui/T'
import type { Reward } from '@/types'
import { Plus, Zap } from 'lucide-react'

export default async function AdminRewardsPage() {
  const [supabase, profile] = await Promise.all([createClient(), getCurrentUser()])
  const { data: rewards } = await supabase
    .from('rewards')
    .select('*')
    .eq('is_deleted', false)
    .order('points_cost', { ascending: true })

  const canManage = profile?.role === 'superadmin'
  const canToggle = profile?.role === 'admin' || profile?.role === 'superadmin'

  const active = rewards?.filter((r) => r.is_active) ?? []
  const inactive = rewards?.filter((r) => !r.is_active) ?? []

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">
          <T k="admin.pageHeadingRewards" />
        </h1>
        {canManage && (
          <Link href="/admin/rewards/new">
            <Button size="sm">
              <Plus className="w-4 h-4 -ml-0.5 mr-1" />
              <T k="admin.newReward" />
            </Button>
          </Link>
        )}
      </div>

      {rewards && rewards.length > 0 ? (
        <div className="space-y-4">
          {active.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                <T k="admin.active" />
              </p>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
                {active.map((r) => (
                  <RewardAdminRow
                    key={r.id}
                    reward={r as Reward}
                    canToggle={canToggle}
                    canManage={canManage}
                  />
                ))}
              </div>
            </section>
          )}

          {inactive.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                <T k="admin.inactive" />
              </p>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
                {inactive.map((r) => (
                  <RewardAdminRow
                    key={r.id}
                    reward={r as Reward}
                    canToggle={canToggle}
                    canManage={canManage}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className="text-center py-14 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <Zap className="w-7 h-7 text-gray-300" />
          </div>
          <p className="text-sm font-medium text-gray-500">
            <T k="admin.noRewards" />
          </p>
          {canManage && (
            <Link
              href="/admin/rewards/new"
              className="inline-block mt-3 text-sm text-brand-600 hover:underline font-medium"
            >
              <T k="admin.createOne" />
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
