import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Plus, Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getAppRole } from '@/lib/apps.server'
import { isLoyaltyApp, loyaltyApi, loyaltyPath } from '@/lib/loyalty'
import RewardAdminRow from '@/components/admin/RewardAdminRow'
import Button from '@/components/ui/Button'
import T from '@/components/ui/T'
import type { Reward } from '@/types'

export const dynamic = 'force-dynamic'

/**
 * Rewards of one business. Any admin of it may switch a reward on or off;
 * only its owner (superadmin) creates, edits or deletes - same split as futsal.
 */
export default async function LoyaltyRewardsPage({ params }: { params: Promise<{ app: string }> }) {
  const { app } = await params
  if (!isLoyaltyApp(app)) notFound()

  const supabase = await createClient()
  const [{ data }, role] = await Promise.all([
    supabase
      .from('rewards')
      .select('*')
      .eq('app', app)
      .eq('is_deleted', false)
      .order('points_cost', { ascending: true }),
    getAppRole(app),
  ])

  const rewards = (data ?? []) as Reward[]
  const canManage = role === 'superadmin'
  const sections = [
    { key: 'admin.active' as const, items: rewards.filter((r) => r.is_active) },
    { key: 'admin.inactive' as const, items: rewards.filter((r) => !r.is_active) },
  ].filter((s) => s.items.length > 0)

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Link href={loyaltyPath(app, '/rewards/new')} prefetch={false}>
            <Button size="sm">
              <Plus className="w-4 h-4 -ml-0.5 mr-1" />
              <T k="admin.newReward" />
            </Button>
          </Link>
        </div>
      )}

      {sections.length === 0 ? (
        <div className="text-center py-14 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <Zap className="w-7 h-7 text-gray-300" />
          </div>
          <p className="text-sm font-medium text-gray-500">
            <T k="loyalty.rewardsEmpty" />
          </p>
        </div>
      ) : (
        sections.map((s) => (
          <section key={s.key}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              <T k={s.key} />
            </p>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
              {s.items.map((r) => (
                <RewardAdminRow
                  key={r.id}
                  reward={r}
                  canToggle
                  canManage={canManage}
                  apiBase={loyaltyApi(app, '/rewards')}
                  editHref={loyaltyPath(app, `/rewards/${r.id}/edit`)}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
