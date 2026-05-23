import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import RewardForm from '@/components/admin/RewardForm'
import Link from 'next/link'
import T from '@/components/ui/T'
import type { Reward } from '@/types'

export default async function EditRewardPage({ params }: { params: Promise<{ id: string }> }) {
  const [profile, { id }] = await Promise.all([getCurrentUser(), params])
  if (profile?.role !== 'superadmin') redirect('/admin/rewards')

  const supabase = await createClient()
  const { data: reward } = await supabase.from('rewards').select('*').eq('id', id).single()
  if (!reward) redirect('/admin/rewards')

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/rewards" className="text-sm text-brand-600 hover:underline">
          <T k="admin.backToRewards" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mt-1"><T k="admin.editRewardTitle" /></h1>
      </div>
      <RewardForm reward={reward as Reward} mode="edit" />
    </div>
  )
}
