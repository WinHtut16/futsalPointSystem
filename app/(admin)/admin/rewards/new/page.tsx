import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import RewardForm from '@/components/admin/RewardForm'
import Link from 'next/link'

export default async function NewRewardPage() {
  const profile = await getCurrentUser()
  if (profile?.role !== 'superadmin') redirect('/admin/rewards')

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/rewards" className="text-sm text-brand-600 hover:underline">
          ← Rewards
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mt-1">New Reward</h1>
      </div>
      <RewardForm />
    </div>
  )
}
