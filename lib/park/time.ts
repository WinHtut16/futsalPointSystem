import { toMyDigits } from '@/lib/utils'
import type { Language } from '@/lib/i18n'
import type { Hours } from './content'

// Myanmar is UTC+6:30 all year (no DST).
const MYANMAR_OFFSET_MIN = 390

/** Current time of day in Myanmar as fractional hours, e.g. 14.5 for 2:30 PM. */
export function myanmarHourNow(now: Date = new Date()): number {
  const minutes = (now.getUTCHours() * 60 + now.getUTCMinutes() + MYANMAR_OFFSET_MIN) % 1440
  return minutes / 60
}

export function isOpenAt(hours: Hours, hour: number): boolean {
  return hour >= hours.open && hour < hours.close
}

/** "10 PM" / "ည ၁၀ နာရီ". Whole hours only; the park keeps hourly schedules. */
export function formatHour(hour: number, lang: Language): string {
  const h = ((hour % 24) + 24) % 24
  const h12 = h % 12 === 0 ? 12 : h % 12
  if (lang === 'my') {
    const period = h < 12 ? 'နံနက်' : h < 16 ? 'နေ့လယ်' : h < 19 ? 'ညနေ' : 'ည'
    return `${period} ${toMyDigits(h12)} နာရီ`
  }
  return `${h12} ${h < 12 ? 'AM' : 'PM'}`
}

/** Thousands-grouped number in the reader's digits: 25,000 / ၂၅,၀၀၀. */
export function formatAmount(n: number, lang: Language): string {
  const s = n.toLocaleString('en-US')
  return lang === 'my' ? s.replace(/\d/g, (d) => toMyDigits(+d)) : s
}
