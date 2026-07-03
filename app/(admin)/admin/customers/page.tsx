import { createClient } from '@/lib/supabase/server'
import Card from '@/components/ui/Card'
import CustomerSearch from '@/components/admin/CustomerSearch'
import CustomersTable from '@/components/admin/CustomersTable'
import T from '@/components/ui/T'
import type { Profile } from '@/types'
import { POINTS_PER_HOUR } from '@/lib/points'

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const supabase = await createClient()
  const { q } = await searchParams
  const query = q?.trim() ?? ''

  let dbQuery = supabase
    .from('profiles')
    .select('*')
    .eq('role', 'customer')
    .order('created_at', { ascending: false })

  if (query) {
    dbQuery = dbQuery.or(`phone.ilike.%${query}%,username.ilike.%${query}%`)
  }

  const [{ data: customers }, { data: earnTx }] = await Promise.all([
    dbQuery.limit(200),
    supabase
      .from('point_transactions')
      .select('customer_id, points_delta')
      .eq('transaction_type', 'earn'),
  ])

  // Build hours-played map per customer
  const hoursMap = new Map<string, number>()
  earnTx?.forEach((tx) => {
    hoursMap.set(
      tx.customer_id,
      (hoursMap.get(tx.customer_id) ?? 0) + tx.points_delta / POINTS_PER_HOUR,
    )
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">
          <T k="admin.pageHeadingCustomers" />
        </h1>
        <span className="text-xs text-gray-400 font-medium">
          {customers?.length ?? 0} total
        </span>
      </div>

      <CustomerSearch defaultValue={query} />

      <Card className="p-0">
        {customers && customers.length > 0 ? (
          <CustomersTable customers={customers as Profile[]} hoursMap={hoursMap} />
        ) : (
          <p className="text-sm text-gray-400 text-center py-10">
            {query ? <T k="admin.noCustomersSearch" /> : <T k="admin.noCustomers" />}
          </p>
        )}
      </Card>
    </div>
  )
}
