import { notFound } from 'next/navigation'
import { Search, Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getWalletBalance } from '@/lib/points'
import { isLoyaltyApp, loyaltyApi } from '@/lib/loyalty'
import AdjustPointsForm from '@/components/admin/AdjustPointsForm'
import TransactionItem from '@/components/customer/TransactionItem'
import T from '@/components/ui/T'
import type { PointTransaction } from '@/types'

export const dynamic = 'force-dynamic'

/**
 * One customer's balance and history AT THIS BUSINESS, found by exact phone
 * (public.find_customer_by_phone - staff only, no browsing the customer
 * list). Corrections go through /api/loyalty/<app>/points/adjust.
 */
export default async function LoyaltyCustomersPage({
  params,
  searchParams,
}: {
  params: Promise<{ app: string }>
  searchParams: Promise<{ q?: string }>
}) {
  const [{ app }, { q }] = await Promise.all([params, searchParams])
  if (!isLoyaltyApp(app)) notFound()

  const query = (q ?? '').trim()
  const supabase = await createClient()

  let state: 'idle' | 'invalid' | 'none' | 'found' = 'idle'
  let customer: { id: string; username: string; phone: string } | null = null
  let balance = 0
  let history: PointTransaction[] = []

  if (query) {
    const { data, error } = await supabase.rpc('find_customer_by_phone', { p_phone: query })
    if (error) {
      // 22023 = not a valid Myanmar number; anything else is a fault worth logging.
      if (error.code !== '22023') console.error('[loyalty] find_customer_by_phone failed', error.code, error.message)
      state = 'invalid'
    } else if (!data || data.length === 0) {
      state = 'none'
    } else {
      state = 'found'
      customer = data[0] as { id: string; username: string; phone: string }
      const [bal, { data: txns }] = await Promise.all([
        getWalletBalance(supabase, customer.id, app),
        supabase
          .from('point_transactions')
          .select('*, reward:rewards(name)')
          .eq('customer_id', customer.id)
          .eq('app', app)
          .order('created_at', { ascending: false })
          .limit(50),
      ])
      balance = bal
      history = (txns ?? []) as PointTransaction[]
    }
  }

  return (
    <div className="space-y-4">
      <form method="get" className="flex gap-2">
        <input
          name="q"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          defaultValue={query}
          placeholder="09…"
          aria-label="phone"
          className="flex-1 min-w-0 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-primary"
        />
        <button
          type="submit"
          className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark"
        >
          <Search className="w-4 h-4" />
          <T k="loyalty.customerSearchButton" />
        </button>
      </form>

      {state === 'idle' && (
        <p className="text-sm text-gray-500">
          <T k="loyalty.customerHint" />
        </p>
      )}
      {state === 'invalid' && (
        <p className="text-sm text-red-600">
          <T k="loyalty.customerInvalidPhone" />
        </p>
      )}
      {state === 'none' && (
        <p className="text-sm text-gray-600">
          <T k="loyalty.customerNotFound" />
        </p>
      )}

      {customer && (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="font-semibold text-gray-900 truncate">{customer.username}</div>
              <div className="text-sm text-gray-500 font-mono">{customer.phone}</div>
            </div>
            <div className="text-right">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                <T k="loyalty.balance" />
              </div>
              <div className={`flex items-center justify-end gap-1 font-display text-3xl font-bold ${balance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                <Star className="w-5 h-5 text-amber-500" />
                {balance.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <AdjustPointsForm
              customerId={customer.id}
              customerName={customer.username}
              endpoint={loyaltyApi(app, '/points/adjust')}
            />
          </div>

          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              <T k="loyalty.history" />
            </p>
            {history.length === 0 ? (
              <p className="text-sm text-gray-500">
                <T k="loyalty.historyEmpty" />
              </p>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
                {history.map((tx) => (
                  <TransactionItem key={tx.id} tx={tx} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
