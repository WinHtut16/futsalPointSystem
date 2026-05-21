import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import TransactionItem from '@/components/customer/TransactionItem'
import PendingRequestItem from '@/components/customer/PendingRequestItem'
import Card from '@/components/ui/Card'
import type { PointTransaction, RedemptionRequest } from '@/types'

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const profile = await getCurrentUser()
  if (!profile) redirect('/login')

  const { page: pageStr } = await searchParams
  const page = Math.max(0, parseInt(pageStr ?? '0'))
  const pageSize = 20
  const from = page * pageSize
  const to = from + pageSize - 1

  const supabase = await createClient()
  const [{ data: transactions, count }, { data: pendingRequests }] = await Promise.all([
    supabase
      .from('point_transactions')
      .select('*, reward:rewards(name)', { count: 'exact' })
      .eq('customer_id', profile.id)
      .order('created_at', { ascending: false })
      .range(from, to),
    supabase
      .from('redemption_requests')
      .select('*, reward:rewards(name, points_cost)')
      .eq('customer_id', profile.id)
      .eq('status', 'pending')
      .order('requested_at', { ascending: false }),
  ])

  const totalPages = Math.ceil((count ?? 0) / pageSize)
  const hasPending = pendingRequests && pendingRequests.length > 0

  return (
    <div className="px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Point History</h1>
        <span className="text-sm text-gray-500 bg-white border border-gray-200 px-2 py-1 rounded-lg font-semibold text-brand-600">
          {profile.total_points} pts
        </span>
      </div>

      {hasPending && (
        <Card className="p-0">
          <div className="px-4 pt-3 pb-1 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-700">Pending Requests</h2>
            <span className="bg-yellow-100 text-yellow-700 text-xs font-semibold px-1.5 py-0.5 rounded-full">
              {pendingRequests.length}
            </span>
          </div>
          <div className="px-4">
            {pendingRequests.map((req) => (
              <PendingRequestItem key={req.id} request={req as RedemptionRequest} />
            ))}
          </div>
        </Card>
      )}

      <Card className="p-0">
        {transactions && transactions.length > 0 ? (
          <div className="divide-y divide-gray-100 px-4">
            {transactions.map((tx) => (
              <TransactionItem key={tx.id} tx={tx as PointTransaction} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-10">No transactions yet.</p>
        )}
      </Card>

      {totalPages > 1 && (
        <div className="flex justify-center gap-4 text-sm">
          {page > 0 && (
            <a href={`?page=${page - 1}`} className="text-brand-600 font-medium hover:underline">
              Previous
            </a>
          )}
          <span className="text-gray-400">
            Page {page + 1} of {totalPages}
          </span>
          {page < totalPages - 1 && (
            <a href={`?page=${page + 1}`} className="text-brand-600 font-medium hover:underline">
              Next
            </a>
          )}
        </div>
      )}
    </div>
  )
}
