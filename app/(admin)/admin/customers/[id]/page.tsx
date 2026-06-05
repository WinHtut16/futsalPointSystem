import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { notFound } from 'next/navigation'
import TransactionItem from '@/components/customer/TransactionItem'
import AddPointsForm from '@/components/admin/AddPointsForm'
import AdjustPointsForm from '@/components/admin/AdjustPointsForm'
import DeleteCustomerButton from '@/components/admin/DeleteCustomerButton'
import T from '@/components/ui/T'
import type { PointTransaction } from '@/types'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { getAvatarColor, getInitials } from '@/components/admin/CustomerRow'
import { POINTS_PER_HOUR } from '@/lib/points'
import { KeyRound, ChevronLeft } from 'lucide-react'
import TempPasswordModal from '@/components/admin/TempPasswordModal'
import CustomerDetailActions from '@/components/admin/CustomerDetailActions'

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [supabase, currentUser] = await Promise.all([createClient(), getCurrentUser()])

  const [{ data: customer }, { data: transactions }, { count: timesRedeemed }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', id).single(),
    supabase
      .from('point_transactions')
      .select('*, reward:rewards(name)')
      .eq('customer_id', id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('redemption_requests')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', id)
      .eq('status', 'approved'),
  ])

  if (!customer || customer.role !== 'customer') notFound()

  const canDelete = currentUser?.role === 'admin' || currentUser?.role === 'superadmin'

  // Hours played: sum of earn transactions / rate
  const hoursPlayed =
    transactions
      ?.filter((t) => t.transaction_type === 'earn')
      .reduce((s, t) => s + t.points_delta, 0) ?? 0
  const hoursNum = hoursPlayed / POINTS_PER_HOUR

  const color = getAvatarColor(customer.username)
  const initials = getInitials(customer.username)

  return (
    <div className="space-y-5">
      <Link href="/admin/customers" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
        <ChevronLeft className="w-4 h-4" />
        <T k="admin.backToCustomers" />
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,340px)_1fr] gap-5 items-start">
        {/* LEFT COLUMN */}
        <div className="space-y-4">
          {/* Profile card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex flex-col items-center text-center gap-3 pb-4 border-b border-gray-100">
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold ${color.bg} ${color.text}`}
              >
                {initials}
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{customer.username}</p>
                {customer.phone && (
                  <p className="text-sm text-gray-500 mt-0.5">{customer.phone}</p>
                )}
                <p className="text-xs text-gray-400 mt-0.5">
                  <T k="admin.memberSince" />: {formatDate(customer.created_at)}
                </p>
              </div>
              <div className="mt-1">
                <p className="text-4xl font-bold text-primary leading-none">
                  {customer.total_points.toLocaleString()}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  <T k="common.pts" />
                </p>
              </div>
            </div>
            <div className="flex justify-center gap-8 pt-4">
              <div className="text-center">
                <p className="text-lg font-bold text-gray-800">{hoursNum.toFixed(1)}</p>
                <p className="text-xs text-gray-400"><T k="admin.hoursPlayedStat" /></p>
              </div>
              <div className="w-px bg-gray-100" />
              <div className="text-center">
                <p className="text-lg font-bold text-gray-800">{timesRedeemed ?? 0}</p>
                <p className="text-xs text-gray-400"><T k="admin.timesRedeemedStat" /></p>
              </div>
            </div>
          </div>

          {/* Add Points */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h2 className="font-semibold text-gray-900 mb-4 text-sm"><T k="admin.addPointsSection" /></h2>
            <AddPointsForm customerId={id} customerName={customer.username} />
          </div>

          {/* Adjust Points */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h2 className="font-semibold text-gray-900 mb-4 text-sm"><T k="admin.adjustPointsSection" /></h2>
            <AdjustPointsForm customerId={id} customerName={customer.username} />
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-4">
          {/* Transaction history */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-0">
            <h2 className="font-semibold text-gray-900 px-4 pt-4 pb-2 text-sm">
              <T k="admin.transactionHistory" />
            </h2>
            {transactions && transactions.length > 0 ? (
              <div className="max-h-[480px] overflow-y-auto divide-y divide-gray-100">
                {transactions.map((tx) => (
                  <TransactionItem key={tx.id} tx={tx as PointTransaction} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8 pb-6">
                <T k="admin.noTransactions" />
              </p>
            )}
          </div>

          {/* Account actions */}
          {canDelete && (
            <CustomerDetailActions
              customerId={id}
              customerName={customer.username}
              customerPhone={customer.phone ?? ''}
            />
          )}
        </div>
      </div>
    </div>
  )
}
