import { createClient } from '@/lib/supabase/server'
import Card from '@/components/ui/Card'
import TransactionItem from '@/components/customer/TransactionItem'
import type { PointTransaction } from '@/types'

export default async function AdminDashboardPage() {
  const supabase = await createClient()

  const [
    { count: customerCount },
    { data: pointsData },
    { data: recentTx },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'customer'),
    supabase.from('point_transactions').select('points_delta').eq('transaction_type', 'earn'),
    supabase
      .from('point_transactions')
      .select('*, reward:rewards(name), creator:profiles!created_by(username)')
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const totalPointsIssued = pointsData?.reduce((sum, t) => sum + t.points_delta, 0) ?? 0

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>

      <div className="grid grid-cols-2 gap-3">
        <Card className="text-center">
          <p className="text-3xl font-bold text-brand-600">{customerCount ?? 0}</p>
          <p className="text-xs text-gray-500 mt-1">Total Customers</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-brand-600">{totalPointsIssued.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">Points Issued</p>
        </Card>
      </div>

      <Card>
        <h2 className="font-semibold text-gray-900 mb-3">Recent Transactions</h2>
        {recentTx && recentTx.length > 0 ? (
          recentTx.map((tx) => (
            <TransactionItem key={tx.id} tx={tx as PointTransaction} />
          ))
        ) : (
          <p className="text-sm text-gray-400 text-center py-6">No transactions yet.</p>
        )}
      </Card>
    </div>
  )
}
