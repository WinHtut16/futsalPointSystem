import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { notFound } from 'next/navigation'
import Card from '@/components/ui/Card'
import TransactionItem from '@/components/customer/TransactionItem'
import AddPointsForm from '@/components/admin/AddPointsForm'
import AdjustPointsForm from '@/components/admin/AdjustPointsForm'
import ResetPasswordForm from '@/components/admin/ResetPasswordForm'
import DeleteCustomerButton from '@/components/admin/DeleteCustomerButton'
import T from '@/components/ui/T'
import type { PointTransaction } from '@/types'
import Link from 'next/link'

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [supabase, currentUser] = await Promise.all([createClient(), getCurrentUser()])

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

  const canDelete = currentUser?.role === 'admin' || currentUser?.role === 'superadmin'

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link href="/admin/customers" className="text-sm text-brand-600 hover:underline">
          <T k="admin.backToCustomers" />
        </Link>
      </div>

      <Card>
        <p className="text-xl font-bold text-gray-900">{customer.username}</p>
        <p className="text-sm text-gray-500">{customer.phone}</p>
        <p className="text-3xl font-bold text-brand-600 mt-3">
          {customer.total_points.toLocaleString()} <span className="text-base font-normal text-gray-400"><T k="common.pts" /></span>
        </p>
      </Card>

      <Card>
        <h2 className="font-semibold text-gray-900 mb-4"><T k="admin.addPointsSection" /></h2>
        <AddPointsForm customerId={id} customerName={customer.username} />
      </Card>

      <Card>
        <h2 className="font-semibold text-gray-900 mb-4"><T k="admin.adjustPointsSection" /></h2>
        <AdjustPointsForm customerId={id} customerName={customer.username} />
      </Card>

      <Card>
        <h2 className="font-semibold text-gray-900 mb-4"><T k="admin.resetPasswordSection" /></h2>
        <ResetPasswordForm customerId={id} customerName={customer.username} />
      </Card>

      <Card className="p-0">
        <h2 className="font-semibold text-gray-900 px-4 pt-4 pb-2"><T k="admin.transactionHistory" /></h2>
        {transactions && transactions.length > 0 ? (
          <div className="px-4 max-h-80 overflow-y-auto divide-y divide-gray-100">
            {transactions.map((tx) => (
              <TransactionItem key={tx.id} tx={tx as PointTransaction} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8"><T k="admin.noTransactions" /></p>
        )}
      </Card>

      {canDelete && (
        <Card>
          <h2 className="font-semibold text-gray-900 mb-3"><T k="admin.dangerZone" /></h2>
          <DeleteCustomerButton
            customerId={id}
            customerName={customer.username}
            customerPhone={customer.phone ?? ''}
          />
        </Card>
      )}
    </div>
  )
}
