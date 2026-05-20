import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Card from '@/components/ui/Card'
import TransactionItem from '@/components/customer/TransactionItem'
import AddPointsForm from '@/components/admin/AddPointsForm'
import type { PointTransaction } from '@/types'
import Link from 'next/link'

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: customer } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single()

  if (!customer || customer.role !== 'customer') notFound()

  const { data: transactions } = await supabase
    .from('point_transactions')
    .select('*, reward:rewards(name)')
    .eq('customer_id', id)
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link href="/admin/customers" className="text-sm text-brand-600 hover:underline">
          ← Customers
        </Link>
      </div>

      <Card>
        <p className="text-xl font-bold text-gray-900">{customer.username}</p>
        <p className="text-sm text-gray-500">{customer.phone}</p>
        <p className="text-3xl font-bold text-brand-600 mt-3">
          {customer.total_points.toLocaleString()} <span className="text-base font-normal text-gray-400">pts</span>
        </p>
      </Card>

      <Card>
        <h2 className="font-semibold text-gray-900 mb-4">Add Points</h2>
        <AddPointsForm customerId={id} customerName={customer.username} />
      </Card>

      <Card className="p-0">
        <h2 className="font-semibold text-gray-900 px-4 pt-4 pb-2">Transaction History</h2>
        {transactions && transactions.length > 0 ? (
          <div className="px-4 divide-y divide-gray-100">
            {transactions.map((tx) => (
              <TransactionItem key={tx.id} tx={tx as PointTransaction} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">No transactions yet.</p>
        )}
      </Card>
    </div>
  )
}
