import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import TransactionItem from '@/components/customer/TransactionItem'
import PendingRequestsList from '@/components/customer/PendingRequestsList'
import RealtimePointsBadge from '@/components/customer/RealtimePointsBadge'
import Card from '@/components/ui/Card'
import T from '@/components/ui/T'
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

  return (
    <div className="px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900"><T k="history.title" /></h1>
        <RealtimePointsBadge userId={profile.id} initialPoints={profile.total_points} />
      </div>

      <PendingRequestsList
        initialRequests={(pendingRequests ?? []) as RedemptionRequest[]}
        userId={profile.id}
      />

      <Card className="p-0">
        {transactions && transactions.length > 0 ? (
          <div className="divide-y divide-gray-100 px-4">
            {transactions.map((tx) => (
              <TransactionItem key={tx.id} tx={tx as PointTransaction} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-10"><T k="history.noTransactions" /></p>
        )}
      </Card>

      {totalPages > 1 && (
        <div className="flex justify-center gap-4 text-sm">
          {page > 0 && (
            <Link href={`?page=${page - 1}`} className="text-brand-600 font-medium hover:underline">
              <T k="history.previous" />
            </Link>
          )}
          <span className="text-gray-400">
            <T k="history.pageOf" vars={{ page: page + 1, total: totalPages }} />
          </span>
          {page < totalPages - 1 && (
            <Link href={`?page=${page + 1}`} className="text-brand-600 font-medium hover:underline">
              <T k="history.next" />
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
