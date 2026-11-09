import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getAppRole } from '@/lib/apps.server'
import { isLoyaltyApp, loyaltyApi, loyaltyPath } from '@/lib/loyalty'
import RewardForm from '@/components/admin/RewardForm'
import T from '@/components/ui/T'
import type { Reward } from '@/types'

export default async function LoyaltyEditRewardPage({
  params,
}: {
  params: Promise<{ app: string; id: string }>
}) {
  const { app, id } = await params
  if (!isLoyaltyApp(app)) notFound()
  if ((await getAppRole(app)) !== 'superadmin') redirect(loyaltyPath(app, '/rewards'))

  const supabase = await createClient()
  // Pinned to this business: another business's reward id is simply not here.
  const { data: reward } = await supabase
    .from('rewards')
    .select('*')
    .eq('id', id)
    .eq('app', app)
    .eq('is_deleted', false)
    .maybeSingle()
  if (!reward) redirect(loyaltyPath(app, '/rewards'))

  return (
    <div className="max-w-form space-y-4">
      <div>
        <Link href={loyaltyPath(app, '/rewards')} prefetch={false} className="text-sm text-brand-600 hover:underline">
          <T k="admin.backToRewards" />
        </Link>
        <h2 className="text-lg font-bold text-gray-900 mt-1">
          <T k="admin.editRewardTitle" />
        </h2>
      </div>
      <RewardForm
        reward={reward as Reward}
        mode="edit"
        apiBase={loyaltyApi(app, '/rewards')}
        backHref={loyaltyPath(app, '/rewards')}
      />
    </div>
  )
}
