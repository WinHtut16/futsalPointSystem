// Pure booking logic — pricing tiers, holiday detection, slot helpers.
// Operates on ISO calendar dates ('YYYY-MM-DD') to stay timezone-safe.

import { isHoliday } from './holidays'

export const MAX_SLOTS = 2
export const OPEN_HOUR = 6 // first slot starts 06:00
export const CLOSE_HOUR = 22 // last slot ends 22:00 (last start = 21:00)
export const DEPOSIT_PER_SLOT = 10000
export const CANCEL_WINDOW_HOURS = 12

export const TIER_PRICE = {
  morning: 20000, // weekday 06:00–14:00
  evening: 25000, // weekday 14:00–22:00
  weekend: 30000, // weekend / public holiday, all day
} as const

export type PriceTier = keyof typeof TIER_PRICE
export type SlotState = 'available' | 'pending' | 'booked' | 'closed'

type Ymd = { y: number; m: number; d: number }

function parseYmd(date: string): Ymd {
  const [y, m, d] = date.split('-').map(Number)
  return { y, m, d }
}

// Day-of-week using a UTC date so it never shifts with the runtime timezone.
export function weekdayOf(date: string): number {
  const { y, m, d } = parseYmd(date)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 = Sunday … 6 = Saturday
}

export function isWeekend(date: string): boolean {
  const wd = weekdayOf(date)
  return wd === 0 || wd === 6
}

// Thingyan (Myanmar New Year): Apr 13–16 each year. Only auto-marked holiday.
export function isThingyan(date: string): boolean {
  const { m, d } = parseYmd(date)
  return m === 4 && d >= 13 && d <= 16
}

// Weekend/holiday days are charged at the flat weekend rate all day.
// Includes Myanmar public holidays from lib/holidays.ts; isThingyan handles
// Thingyan for years not yet covered by the annual holiday config.
export function isWeekendRate(date: string): boolean {
  return isWeekend(date) || isThingyan(date) || isHoliday(date)
}

export function tierForHour(date: string, hour: number): PriceTier {
  if (isWeekendRate(date)) return 'weekend'
  return hour < 14 ? 'morning' : 'evening'
}

export function priceForHour(date: string, hour: number): number {
  return TIER_PRICE[tierForHour(date, hour)]
}

// "06:00 – 07:00"
export function formatHourRange(hour: number): string {
  const pad = (h: number) => String(h).padStart(2, '0')
  return `${pad(hour)}:00 – ${pad(hour + 1)}:00`
}

// All bookable start-hours for a day (06:00 … 21:00 → 16 slots).
export function dayHours(): number[] {
  const hours: number[] = []
  for (let h = OPEN_HOUR; h < CLOSE_HOUR; h++) hours.push(h)
  return hours
}

// Deposit is a flat 10,000 MMK per booking regardless of slot count.
export function depositFor(_slotCount: number): number {
  return DEPOSIT_PER_SLOT
}

// Whether a confirmed booking can still be cancelled for a full refund:
// true when the slot start is CANCEL_WINDOW_HOURS or more in the future.
export function canCancel(bookingDate: string, hourStart: number, now: Date = new Date()): boolean {
  const { y, m, d } = parseYmd(bookingDate)
  const slotStart = new Date(Date.UTC(y, m - 1, d, hourStart, 0, 0))
  const diffHours = (slotStart.getTime() - now.getTime()) / 3_600_000
  return diffHours >= CANCEL_WINDOW_HOURS
}

// Minimum lead time (hours) required to book a slot.
export const BOOKING_LEAD_HOURS = 1

// Myanmar is UTC+6:30. Converts a "date + hour" in Myanmar local time to UTC ms.
const MYANMAR_OFFSET_MS = (6 * 60 + 30) * 60 * 1000

// Returns false when the slot start is less than BOOKING_LEAD_HOURS away —
// i.e., the slot is in the past or too soon to book.
export function isSlotBookable(dateISO: string, hourStart: number, now: Date = new Date()): boolean {
  const { y, m, d } = parseYmd(dateISO)
  const slotStartUTC = Date.UTC(y, m - 1, d, hourStart, 0, 0) - MYANMAR_OFFSET_MS
  return slotStartUTC - now.getTime() >= BOOKING_LEAD_HOURS * 3_600_000
}
