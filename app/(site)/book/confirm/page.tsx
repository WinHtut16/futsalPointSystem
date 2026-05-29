import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { MAX_SLOTS } from '@/lib/booking'
import SiteNavbar from '@/components/booking/SiteNavbar'
import ConfirmFlow from '@/components/booking/ConfirmFlow'

export const dynamic = 'force-dynamic'

type BookingGroup = { date: string; hours: number[]; overrideHours?: number[] }

// Parse ?items=2026-05-28_7,2026-05-29_8 format
function parseItems(raw: string, overrideSet: Set<string>): BookingGroup[] | null {
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

  const groups: BookingGroup[] = Array.from(map.entries()).map(([date, hoursSet]) => {
    const hours = Array.from(hoursSet).sort((a, b) => a - b)
    const overrideHours = hours.filter(h => overrideSet.has(`${date}_${h}`))
    return { date, hours, ...(overrideHours.length > 0 ? { overrideHours } : {}) }
  })
  const totalSlots = groups.reduce((s, g) => s + g.hours.length, 0)
  if (totalSlots > MAX_SLOTS) return null

  return groups
}

// Parse ?overrides=YYYY-MM-DD_H,... into a Set of "YYYY-MM-DD_H" keys
function parseOverrides(raw: string): Set<string> {
  const set = new Set<string>()
  for (const token of raw.split(',')) {
    const under = token.lastIndexOf('_')
    if (under < 0) continue
    const date = token.slice(0, under)
    const hour = Number(token.slice(under + 1))
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isInteger(hour) && hour >= 6 && hour < 22) {
      set.add(`${date}_${hour}`)
    }
  }
  return set
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
  searchParams: Promise<{ items?: string; overrides?: string; date?: string; slots?: string }>
}) {
  const sp = await searchParams

  const user = await getCurrentUser()
  const overrideSet = sp.overrides ? parseOverrides(sp.overrides) : new Set<string>()
  const bookings = sp.items
    ? parseItems(sp.items, overrideSet)
    : parseLegacy(sp.date, sp.slots)

  if (!bookings) redirect('/book')

  const itemsParam = bookings.map(g => g.hours.map(h => `${g.date}_${h}`).join(',')).join(',')
  const overridesParam = bookings
    .flatMap(g => (g.overrideHours ?? []).map(h => `${g.date}_${h}`))
    .join(',')
  const self = overridesParam
    ? `/book/confirm?items=${itemsParam}&overrides=${overridesParam}`
    : `/book/confirm?items=${itemsParam}`

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
