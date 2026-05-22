import { createClient } from '@/lib/supabase/server'
import Card from '@/components/ui/Card'
import TransactionItem from '@/components/customer/TransactionItem'
import PendingRedemptionsBanner from '@/components/admin/PendingRedemptionsBanner'
import T from '@/components/ui/T'
import type { PointTransaction } from '@/types'

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
      <h1 className="text-xl font-bold text-gray-900"><T k="admin.pageHeadingDashboard" /></h1>

      <div className="grid grid-cols-2 gap-3">
        <Card className="text-center">
          <p className="text-3xl font-bold text-brand-600">{customerCount ?? 0}</p>
          <p className="text-xs text-gray-500 mt-1"><T k="admin.totalCustomers" /></p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-brand-600">{totalPointsIssued.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1"><T k="admin.pointsIssued" /></p>
        </Card>
      </div>

      <PendingRedemptionsBanner initialCount={pendingCount ?? 0} />

      <Card className="p-0">
        <h2 className="font-semibold text-gray-900 px-4 pt-4 pb-2"><T k="admin.recentTransactions" /></h2>
        {recentTx && recentTx.length > 0 ? (
          <div className="px-4 max-h-96 overflow-y-auto divide-y divide-gray-100">
            {recentTx.map((tx) => (
              <TransactionItem key={tx.id} tx={tx as PointTransaction} showCustomer />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-6 pb-4"><T k="admin.noTransactions" /></p>
        )}
      </Card>
    </div>
  )
}
