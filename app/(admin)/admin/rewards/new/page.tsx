import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import RewardForm from '@/components/admin/RewardForm'
import Link from 'next/link'
import T from '@/components/ui/T'

export default async function NewRewardPage() {
  const profile = await getCurrentUser()
  if (profile?.role !== 'superadmin') redirect('/admin/rewards')

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/rewards" className="text-sm text-brand-600 hover:underline">
          <T k="admin.backToRewards" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mt-1"><T k="admin.newRewardTitle" /></h1>
      </div>
      <RewardForm />
    </div>
  )
}
