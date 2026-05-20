import { createClient } from '@/lib/supabase/server'
import Card from '@/components/ui/Card'
import CustomerSearch from '@/components/admin/CustomerSearch'
import CustomerRow from '@/components/admin/CustomerRow'
import type { Profile } from '@/types'

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
    dbQuery = dbQuery.ilike('phone', `%${query}%`)
  }

  const { data: customers } = await dbQuery.limit(50)

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Customers</h1>
      <CustomerSearch defaultValue={query} />

      <Card className="p-0">
        {customers && customers.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {customers.map((c) => (
              <CustomerRow key={c.id} customer={c as Profile} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-10">
            {query ? 'No customers found for that search.' : 'No customers yet.'}
          </p>
        )}
      </Card>
    </div>
  )
}
