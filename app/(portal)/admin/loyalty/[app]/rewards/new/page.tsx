import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getAppRole } from '@/lib/apps.server'
import { isLoyaltyApp, loyaltyApi, loyaltyPath } from '@/lib/loyalty'
import RewardForm from '@/components/admin/RewardForm'
import T from '@/components/ui/T'

export default async function LoyaltyNewRewardPage({ params }: { params: Promise<{ app: string }> }) {
  const { app } = await params
  if (!isLoyaltyApp(app)) notFound()
  if ((await getAppRole(app)) !== 'superadmin') redirect(loyaltyPath(app, '/rewards'))

  return (
    <div className="max-w-form space-y-4">
      <div>
        <Link href={loyaltyPath(app, '/rewards')} prefetch={false} className="text-sm text-brand-600 hover:underline">
          <T k="admin.backToRewards" />
        </Link>
        <h2 className="text-lg font-bold text-gray-900 mt-1">
          <T k="admin.newRewardTitle" />
        </h2>
      </div>
      <RewardForm apiBase={loyaltyApi(app, '/rewards')} backHref={loyaltyPath(app, '/rewards')} />
    </div>
  )
}
