'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export type CalendarData = {
  holidays: Record<number, string> // day -> label
  closed: Record<number, string> // day -> reason
  booked: number[]
  pending: number[]
}

const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTHS_MY = ['ဇန်နဝါရီ','ဖေဖော်ဝါရီ','မတ်','ဧပြီ','မေ','ဇွန်','ဇူလိုင်','ဩဂုတ်','စက်တင်ဘာ','အောက်တိုဘာ','နိုဝင်ဘာ','ဒီဇင်ဘာ']
const DOW_EN = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const DOW_MY = ['တနင်္လာ', 'အင်္ဂါ', 'ဗုဒ္ဓဟူး', 'ကြာသပတေး', 'သောကြာ', 'စနေ', 'တနင်္ဂနွေ']

export default function BookingCalendar({
  year,
  monthIdx,
  today,
  data,
  selectedDay,
  onSelect,
  onNav,
}: {
  year: number
  monthIdx: number // 0-11
  today: string // ISO YYYY-MM-DD
  data: CalendarData
  selectedDay: number | null
  onSelect: (day: number) => void
  onNav: (delta: number) => void
}) {
  const { t, lang } = useLanguage()
  const my = lang === 'my' ? 'my' : ''
  const dow = lang === 'my' ? DOW_MY : DOW_EN
  const monthName = (lang === 'my' ? MONTHS_MY : MONTHS_EN)[monthIdx]

  const firstDay = (new Date(year, monthIdx, 1).getDay() + 6) % 7 // Mon = 0
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate()
  const prevDays = new Date(year, monthIdx, 0).getDate()

  type Cell = { d: number; outside: boolean }
  const cells: Cell[] = []
  for (let i = 0; i < firstDay; i++) cells.push({ d: prevDays - firstDay + i + 1, outside: true })
  for (let d = 1; d <= daysInMonth; d++) cells.push({ d, outside: false })
  while (cells.length % 7 !== 0) cells.push({ d: cells.length - firstDay - daysInMonth + 1, outside: true })

  const [ty, tm, td] = today.split('-').map(Number)
  const todayMidnight = new Date(ty, tm - 1, td).getTime()

  const isPast = (d: number, outside: boolean) => {
    if (outside) return true
    return new Date(year, monthIdx, d).getTime() < todayMidnight
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className={`font-display text-base font-bold text-ink-primary ${my}`}>
          {monthName} {year}
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => onNav(-1)}
            className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-line bg-surface text-ink"
            aria-label="Previous month"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            onClick={() => onNav(1)}
            className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-line bg-surface text-ink"
            aria-label="Next month"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-line">
        {/* Day-of-week header row */}
        <div className="grid grid-cols-7 border-b border-line">
          {dow.map((d, i) => (
            <div
              key={i}
              style={{ borderRight: i < 6 ? '1px solid var(--color-line)' : 'none' }}
              className={`py-1.5 text-center font-display font-semibold ${
                lang === 'my'
                  ? 'text-[9px] leading-tight my'
                  : 'text-[10px] uppercase tracking-wider'
              } ${i >= 5 ? 'text-accent' : 'text-ink-muted'}`}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Date cells */}
        <div className="grid grid-cols-7">
          {cells.map((c, i) => {
            const isHol = !c.outside && data.holidays[c.d] != null
            const isClosed = !c.outside && data.closed[c.d] != null
            const isBooked = !c.outside && data.booked.includes(c.d)
            const isPending = !c.outside && data.pending.includes(c.d)
            const past = isPast(c.d, c.outside)
            const sel = !c.outside && c.d === selectedDay
            const isWeekend = i % 7 >= 5
            const clickable = !past && !c.outside && !isClosed

            let bg = 'var(--color-surface)'
            let color = 'var(--color-text-primary)'
            if (c.outside) color = 'var(--color-text-faint)'
            else if (past) color = 'var(--color-text-faint)'
            else if (sel) {
              bg = 'var(--color-primary)'
              color = 'var(--color-on-primary)'
            } else if (isClosed) {
              bg = 'var(--color-slot-closed-bg)'
              color = 'var(--color-slot-closed)'
            } else if (isHol) {
              bg = 'var(--color-holiday-bg)'
              color = 'var(--color-holiday)'
            } else if (isWeekend) color = 'var(--color-accent)'

            return (
              <button
                key={i}
                type="button"
                disabled={!clickable}
                onClick={clickable ? () => onSelect(c.d) : undefined}
                title={isHol ? data.holidays[c.d] : undefined}
                className="relative flex flex-col items-start p-1.5 font-display text-[13px]"
                style={{
                  aspectRatio: '1 / 1.05',
                  background: bg,
                  color,
                  fontWeight: sel ? 700 : isHol || isClosed ? 600 : 500,
                  opacity: past ? 0.45 : 1,
                  cursor: clickable ? 'pointer' : 'default',
                  textDecoration: isClosed ? 'line-through' : 'none',
                  outline: sel ? '2px solid var(--color-primary-dark)' : 'none',
                  outlineOffset: -2,
                  borderRight: i % 7 < 6 ? '1px solid var(--color-line)' : 'none',
                  borderBottom: '1px solid var(--color-line)',
                }}
              >
                <span>{c.d}</span>
                <span className="absolute bottom-1 left-0 right-0 flex justify-center gap-0.5">
                  {isHol && (
                    <span className="h-1 w-1 rounded-full" style={{ background: sel ? '#fff' : 'var(--color-holiday)' }} />
                  )}
                  {isBooked && (
                    <span className="h-1 w-1 rounded-full" style={{ background: sel ? '#fff' : 'var(--color-slot-booked)' }} />
                  )}
                  {isPending && (
                    <span className="h-1 w-1 rounded-full" style={{ background: sel ? '#fff' : 'var(--color-slot-pending)' }} />
                  )}
                </span>
                {isClosed && !sel && (
                  <span
                    className={`absolute bottom-0.5 left-0.5 right-0.5 text-center text-[7px] font-bold uppercase tracking-wide ${my}`}
                    style={{ color: 'var(--color-slot-closed)', textDecoration: 'none' }}
                  >
                    {t('booking.cal.closed')}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1 w-1 rounded-full bg-holiday" />
          <span className={my}>{t('booking.cal.publicHoliday')}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border border-slot-closed bg-slot-closed-bg" />
          <span className={my}>{t('booking.cal.adminClosed')}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1 w-1 rounded-full bg-slot-booked" />
          <span className={my}>{t('booking.cal.hasBookings')}</span>
        </span>
      </div>
    </div>
  )
}
