import { toMyDigits } from '@/lib/utils'
import type { Language, TranslationKey } from '@/lib/i18n'
import type { Hours } from './content'

// Myanmar is UTC+6:30 all year (no DST).
const MYANMAR_OFFSET_MIN = 390

/** Current time of day in Myanmar as fractional hours, e.g. 14.5 for 2:30 PM. */
export function myanmarHourNow(now: Date = new Date()): number {
  const minutes = (now.getUTCHours() * 60 + now.getUTCMinutes() + MYANMAR_OFFSET_MIN) % 1440
  return minutes / 60
}

/** Current weekday in Myanmar, 0 = Sunday ... 6 = Saturday. */
export function myanmarDayNow(now: Date = new Date()): number {
  return new Date(now.getTime() + MYANMAR_OFFSET_MIN * 60_000).getUTCDay()
}

export function isAlwaysOpen(hours: Hours): boolean {
  return hours.open <= 0 && hours.close >= 24 && !hours.closedDays?.length
}

/** Pass `day` to also honour closed weekdays; without it only the time is checked. */
export function isOpenAt(hours: Hours, hour: number, day?: number): boolean {
  if (day !== undefined && hours.closedDays?.includes(day)) return false
  return hour >= hours.open && hour < hours.close
}

/** "10 PM", "5:30 PM" / "ည ၁၀ နာရီ", "ညနေ ၅ နာရီခွဲ". */
export function formatHour(hour: number, lang: Language): string {
  const h = Math.floor(((hour % 24) + 24) % 24)
  const min = Math.round((hour - Math.floor(hour)) * 60)
  const h12 = h % 12 === 0 ? 12 : h % 12
  if (lang === 'my') {
    const period = h < 12 ? 'နံနက်' : h < 16 ? 'နေ့လယ်' : h < 19 ? 'ညနေ' : 'ည'
    if (min === 0) return `${period} ${toMyDigits(h12)} နာရီ`
    if (min === 30) return `${period} ${toMyDigits(h12)} နာရီခွဲ`
    return `${period} ${toMyDigits(h12)}:${String(min).padStart(2, '0').replace(/\d/g, (d) => toMyDigits(+d))}`
  }
  return `${h12}${min ? `:${String(min).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`
}

type T = (key: TranslationKey, vars?: Record<string, string | number>) => string

const WEEKDAY_KEYS: TranslationKey[] = [
  'park.weekday.0',
  'park.weekday.1',
  'park.weekday.2',
  'park.weekday.3',
  'park.weekday.4',
  'park.weekday.5',
  'park.weekday.6',
]

/** "9 AM to 5:30 PM", "Always open". Closed days are left to closedDaysLabel. */
export function hoursRange(hours: Hours, t: T, lang: Language): string {
  if (hours.open <= 0 && hours.close >= 24) return t('park.hours.always')
  return t('park.visit.range', { open: formatHour(hours.open, lang), close: formatHour(hours.close, lang) })
}

/** "Closed Mondays", or null when the venue opens every day. */
export function closedDaysLabel(hours: Hours, t: T): string | null {
  if (!hours.closedDays?.length) return null
  const days = hours.closedDays.map((d) => t(WEEKDAY_KEYS[d])).join(', ')
  return t('park.hours.closed', { days })
}

/** Thousands-grouped number in the reader's digits: 25,000 / ၂၅,၀၀၀. */
export function formatAmount(n: number, lang: Language): string {
  const s = n.toLocaleString('en-US')
  return lang === 'my' ? s.replace(/\d/g, (d) => toMyDigits(+d)) : s
}

const MONTHS_MY = [
  'ဇန်နဝါရီ', 'ဖေဖော်ဝါရီ', 'မတ်', 'ဧပြီ', 'မေ', 'ဇွန်',
  'ဇူလိုင်', 'သြဂုတ်', 'စက်တင်ဘာ', 'အောက်တိုဘာ', 'နိုဝင်ဘာ', 'ဒီဇင်ဘာ',
]

/** "November 2026" / "နိုဝင်ဘာ ၂၀၂၆". `month` is 1-12. */
export function formatMonth(year: number, month: number, lang: Language): string {
  if (lang === 'my') return `${MONTHS_MY[month - 1]} ${toMyDigits(year)}`
  return new Date(Date.UTC(year, month - 1, 15)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export type VenueStatus =
  | { state: 'open'; until: number }
  | { state: 'later'; opens: number }
  | { state: 'closedNow' }
  | { state: 'closedDay'; reopens: number }

/** Where a venue stands right now. `closedDay` is a weekly closed day with
 *  the venue open again tomorrow; otherwise a closed venue is `closedNow`. */
export function venueStatus(hours: Hours, hour: number, day: number): VenueStatus {
  const tomorrowClosed = hours.closedDays?.includes((day + 1) % 7) ?? false
  if (hours.closedDays?.includes(day)) {
    return tomorrowClosed ? { state: 'closedNow' } : { state: 'closedDay', reopens: hours.open }
  }
  if (isOpenAt(hours, hour)) return { state: 'open', until: hours.close }
  if (hour < hours.open) return { state: 'later', opens: hours.open }
  return { state: 'closedNow' }
}
