import { requireAnyAdmin } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import ClosureManager, { type Closure } from '@/components/admin/booking/ClosureManager'

export const dynamic = 'force-dynamic'

function todayYangon(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Yangon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export default async function AdminCourtPage() {
  await requireAnyAdmin()

  let closures: Closure[] = []
  try {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('court_closures')
      .select('id, closure_date, hour_start, reason')
      .gte('closure_date', todayYangon())
      .order('closure_date', { ascending: true })
    closures = (data ?? []) as Closure[]
  } catch {
    // Booking tables not migrated yet.
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Court &amp; slots</h1>
        <p className="mt-1 text-sm text-gray-500">Close the whole court for a day, or deactivate individual slots.</p>
      </div>
      <ClosureManager initial={closures} />
    </div>
  )
}
