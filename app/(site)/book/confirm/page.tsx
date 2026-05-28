import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { MAX_SLOTS } from '@/lib/booking'
import SiteNavbar from '@/components/booking/SiteNavbar'
import ConfirmFlow from '@/components/booking/ConfirmFlow'

export const dynamic = 'force-dynamic'

type BookingGroup = { date: string; hours: number[] }

// Parse ?items=2026-05-28_7,2026-05-29_8 format
function parseItems(raw: string): BookingGroup[] | null {
  const map = new Map<string, Set<number>>()
  for (const token of raw.split(',')) {
    const under = token.lastIndexOf('_')
    if (under < 0) return null
    const date = token.slice(0, under)
    const hour = Number(token.slice(under + 1))
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
    if (!Number.isInteger(hour) || hour < 6 || hour >= 22) return null
    if (!map.has(date)) map.set(date, new Set())
    map.get(date)!.add(hour)
  }
  if (map.size === 0) return null

  // Enforce global MAX_SLOTS cap
  const groups: BookingGroup[] = Array.from(map.entries()).map(([date, hoursSet]) => ({
    date,
    hours: Array.from(hoursSet).sort((a, b) => a - b),
  }))
  const totalSlots = groups.reduce((s, g) => s + g.hours.length, 0)
  if (totalSlots > MAX_SLOTS) return null

  return groups
}

// Legacy: parse ?date=YYYY-MM-DD&slots=h1,h2
function parseLegacy(date?: string, slots?: string): BookingGroup[] | null {
  if (!date || !slots) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const hours = slots
    .split(',')
    .map(s => Number(s.trim()))
    .filter(n => Number.isInteger(n) && n >= 6 && n < 22)
  const deduped = Array.from(new Set(hours)).sort((a, b) => a - b).slice(0, 2)
  if (deduped.length === 0) return null
  return [{ date, hours: deduped }]
}

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ items?: string; date?: string; slots?: string }>
}) {
  const sp = await searchParams

  const user = await getCurrentUser()
  const bookings = sp.items ? parseItems(sp.items) : parseLegacy(sp.date, sp.slots)

  if (!bookings) redirect('/book')

  // Build redirect target for unauthenticated users
  const itemsParam = bookings.map(g => g.hours.map(h => `${g.date}_${h}`).join(',')).join(',')
  const self = `/book/confirm?items=${itemsParam}`

  if (!user) redirect(`/login?next=${encodeURIComponent(self)}`)

  return (
    <>
      <SiteNavbar active="booking" mobileTitle="Confirm booking" back />
      <div className="mx-auto max-w-xl md:py-6">
        <ConfirmFlow bookings={bookings} />
      </div>
    </>
  )
}
