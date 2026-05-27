import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import SiteNavbar from '@/components/booking/SiteNavbar'
import ConfirmFlow from '@/components/booking/ConfirmFlow'

export const dynamic = 'force-dynamic'

function parseSlots(raw?: string): number[] {
  if (!raw) return []
  const out = raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n >= 6 && n <= 21)
  return Array.from(new Set(out)).sort((a, b) => a - b).slice(0, 2)
}

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; slots?: string }>
}) {
  const sp = await searchParams
  const self = `/book/confirm?date=${sp.date ?? ''}&slots=${sp.slots ?? ''}`

  const user = await getCurrentUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(self)}`)

  const date = sp.date ?? ''
  const slots = parseSlots(sp.slots)
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date)
  if (!validDate || slots.length === 0) redirect('/book')

  return (
    <>
      <SiteNavbar active="booking" mobileTitle="Confirm booking" back />
      <div className="mx-auto max-w-xl md:py-6">
        <ConfirmFlow bookingDate={date} slots={slots} />
      </div>
    </>
  )
}
