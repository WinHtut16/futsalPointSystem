import { createClient } from '@/lib/supabase/server'
import Card from '@/components/ui/Card'
import TransactionItem from '@/components/customer/TransactionItem'
import type { PointTransaction } from '@/types'
import Link from 'next/link'

export default async function AdminDashboardPage() {
  const supabase = await createClient()

  const [
    { count: customerCount },
    { data: pointsData },
    { data: recentTx },
    { count: pendingCount },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'customer'),
    supabase.from('point_transactions').select('points_delta').eq('transaction_type', 'earn'),
    supabase
      .from('point_transactions')
      .select('*, reward:rewards(name), creator:profiles!created_by(username), customer:profiles!customer_id(username, phone)')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('redemption_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
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

      {(pendingCount ?? 0) > 0 && (
        <Link href="/admin/redemptions">
          <div className="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
            <div>
              <p className="font-semibold text-yellow-800 text-sm">Pending Redemptions</p>
              <p className="text-xs text-yellow-600">Tap to review and approve at the counter</p>
            </div>
            <span className="bg-yellow-400 text-yellow-900 font-bold text-sm px-2.5 py-0.5 rounded-full">
              {pendingCount}
            </span>
          </div>
        </Link>
      )}

      <Card className="p-0">
        <h2 className="font-semibold text-gray-900 px-4 pt-4 pb-2">Recent Transactions</h2>
        {recentTx && recentTx.length > 0 ? (
          <div className="px-4 max-h-96 overflow-y-auto divide-y divide-gray-100">
            {recentTx.map((tx) => (
              <TransactionItem key={tx.id} tx={tx as PointTransaction} showCustomer />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-6 pb-4">No transactions yet.</p>
        )}
      </Card>
    </div>
  )
}
