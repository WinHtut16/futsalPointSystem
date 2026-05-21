import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import PointsCard from '@/components/customer/PointsCard'
import TransactionItem from '@/components/customer/TransactionItem'
import Card from '@/components/ui/Card'
import T from '@/components/ui/T'
import Link from 'next/link'
import type { PointTransaction } from '@/types'

export default async function DashboardPage() {
  const profile = await getCurrentUser()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  const { data: transactions } = await supabase
    .from('point_transactions')
    .select('*, reward:rewards(name)')
    .eq('customer_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(5)

  return (
    <div className="px-4 py-6 space-y-5">
      <PointsCard
        initialPoints={profile.total_points}
        username={profile.username}
        phone={profile.phone ?? ''}
        userId={profile.id}
      />

      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900"><T k="dashboard.recentActivity" /></h2>
          <Link href="/history" className="text-xs text-brand-600 font-medium hover:underline">
            <T k="dashboard.viewAll" />
          </Link>
        </div>
        {transactions && transactions.length > 0 ? (
          transactions.map((tx) => (
            <TransactionItem key={tx.id} tx={tx as PointTransaction} />
          ))
        ) : (
          <p className="text-sm text-gray-400 text-center py-6">
            <T k="dashboard.noActivity" />
          </p>
        )}
      </Card>

      <Card className="text-center">
        <p className="text-sm text-gray-500 mb-2"><T k="dashboard.spendPoints" /></p>
        <Link
          href="/rewards"
          className="inline-flex items-center gap-2 bg-brand-600 text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-brand-700 transition"
        >
          <T k="dashboard.viewRewards" />
        </Link>
      </Card>
    </div>
  )
}
