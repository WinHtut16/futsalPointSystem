import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { isThingyan } from '@/lib/booking'
import { isHoliday, getHolidayName } from '@/lib/holidays'
import SiteNavbar from '@/components/booking/SiteNavbar'
import BookingView, { type DayInfo } from '@/components/booking/BookingView'
import type { CalendarData } from '@/components/booking/BookingCalendar'

export const dynamic = 'force-dynamic'

const pad = (n: number) => String(n).padStart(2, '0')

// Today's calendar date in Myanmar (UTC+6:30), as YYYY-MM-DD.
function todayYangon(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Yangon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  return parts // en-CA gives YYYY-MM-DD
}

function clampMonthYear(monthRaw?: string, yearRaw?: string) {
  const today = todayYangon()
  const [ty, tm] = today.split('-').map(Number)
  let year = Number(yearRaw)
  let month = Number(monthRaw) // 1-12
  if (!Number.isInteger(year) || year < 2023 || year > ty + 2) year = ty
  if (!Number.isInteger(month) || month < 1 || month > 12) month = tm
  return { year, monthIdx: month - 1, today }
}

async function loadMonth(year: number, monthIdx: number) {
  const dayInfo: Record<number, DayInfo> = {}
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate()
  const start = `${year}-${pad(monthIdx + 1)}-01`
  const end = `${year}-${pad(monthIdx + 1)}-${pad(daysInMonth)}`

  const ensure = (day: number): DayInfo =>
    (dayInfo[day] ??= { booked: [], pending: [], closedHours: [], dayClosed: false })

  try {
    const supabase = createServiceClient()

    const { data: slots } = await supabase
      .from('booking_slots')
      .select('hour_start, booking_date, bookings!inner(status)')
      .gte('booking_date', start)
      .lte('booking_date', end)
      .eq('active', true)

    for (const s of slots ?? []) {
      const day = Number((s.booking_date as string).split('-')[2])
      const status = (s.bookings as unknown as { status: string }).status
      const info = ensure(day)
      if (status === 'confirmed') info.booked.push(s.hour_start as number)
      else if (status === 'pending') info.pending.push(s.hour_start as number)
    }

    const { data: closures } = await supabase
      .from('court_closures')
      .select('closure_date, hour_start')
      .gte('closure_date', start)
      .lte('closure_date', end)

    for (const c of closures ?? []) {
      const day = Number((c.closure_date as string).split('-')[2])
      const info = ensure(day)
      if (c.hour_start == null) info.dayClosed = true
      else info.closedHours.push(c.hour_start as number)
    }
  } catch {
    // Table not migrated yet in this environment — render an empty month.
  }

  const calData: CalendarData = { holidays: {}, closed: {}, booked: [], pending: [] }
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${pad(monthIdx + 1)}-${pad(d)}`
    if (isHoliday(iso)) calData.holidays[d] = getHolidayName(iso) ?? 'Holiday'
    else if (isThingyan(iso)) calData.holidays[d] = 'Thingyan' // fallback for years not in config
    const info = dayInfo[d]
    if (info?.dayClosed) calData.closed[d] = 'Closed'
    if (info?.booked.length) calData.booked.push(d)
    if (info?.pending.length) calData.pending.push(d)
  }

  return { dayInfo, calData }
}

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; day?: string }>
}) {
  const sp = await searchParams
  const { year, monthIdx, today } = clampMonthYear(sp.month, sp.year)
  const { dayInfo, calData } = await loadMonth(year, monthIdx)
  const user = await getCurrentUser()

  // Default selected day: requested day, else today if viewing the current month.
  const [ty, tm, td] = today.split('-').map(Number)
  let initialDay: number | null = null
  const reqDay = Number(sp.day)
  if (Number.isInteger(reqDay) && reqDay >= 1 && reqDay <= 31) initialDay = reqDay
  else if (year === ty && monthIdx === tm - 1) initialDay = td

  return (
    <>
      <SiteNavbar active="booking" mobileTitle={undefined} back />
      <div className="animate-page-in mx-auto max-w-6xl md:px-16 md:py-8">
        <BookingView
          key={`${year}-${monthIdx}`}
          year={year}
          monthIdx={monthIdx}
          today={today}
          calData={calData}
          dayInfo={dayInfo}
          initialDay={initialDay}
          loggedIn={!!user}
        />
      </div>
    </>
  )
}
