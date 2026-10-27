import { describe, expect, it } from 'vitest'
import { en, my } from '@/lib/i18n'
import type { TranslationKey } from '@/lib/i18n'
import { HOURS } from '@/lib/park/content'
import {
  closedDaysLabel,
  formatHour,
  hoursRange,
  isAlwaysOpen,
  isOpenAt,
  myanmarDayNow,
  myanmarHourNow,
} from '@/lib/park/time'

const tFor =
  (dict: Record<string, string>) =>
  (key: TranslationKey, vars?: Record<string, string | number>) =>
    Object.entries(vars ?? {}).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), dict[key] ?? key)
const tEn = tFor(en)
const tMy = tFor(my)

describe('formatHour', () => {
  it('formats whole hours', () => {
    expect(formatHour(9, 'en')).toBe('9 AM')
    expect(formatHour(20, 'en')).toBe('8 PM')
    expect(formatHour(0, 'en')).toBe('12 AM')
    expect(formatHour(9, 'my')).toBe('နံနက် ၉ နာရီ')
  })

  it('formats half hours', () => {
    expect(formatHour(17.5, 'en')).toBe('5:30 PM')
    expect(formatHour(17.5, 'my')).toBe('ညနေ ၅ နာရီခွဲ')
  })
})

describe('myanmar clock', () => {
  it('shifts UTC by 6:30', () => {
    // Sunday 20:00 UTC is Monday 02:30 in Yangon.
    const now = new Date(Date.UTC(2026, 9, 25, 20, 0))
    expect(myanmarDayNow(now)).toBe(1)
    expect(myanmarHourNow(now)).toBe(2.5)
  })
})

describe('isOpenAt', () => {
  const pool = HOURS.pool!

  it('respects half-hour closing', () => {
    expect(isOpenAt(pool, 17.25, 2)).toBe(true)
    expect(isOpenAt(pool, 17.5, 2)).toBe(false)
  })

  it('is closed on Mondays', () => {
    expect(isOpenAt(pool, 10, 1)).toBe(false)
    expect(isOpenAt(pool, 10, 0)).toBe(true)
  })

  it('treats 0 to 24 as always open', () => {
    const market = HOURS.market!
    expect(isAlwaysOpen(market)).toBe(true)
    expect(isOpenAt(market, 3, 1)).toBe(true)
    expect(isAlwaysOpen(pool)).toBe(false)
  })
})

describe('labels', () => {
  it('builds ranges', () => {
    expect(hoursRange(HOURS.pool!, tEn, 'en')).toBe('9 AM to 5:30 PM')
    expect(hoursRange(HOURS.market!, tEn, 'en')).toBe('Always open')
    expect(hoursRange(HOURS.market!, tMy, 'my')).toBe('အမြဲဖွင့်သည်')
  })

  it('names closed days', () => {
    expect(closedDaysLabel(HOURS.pool!, tEn)).toBe('Closed Mondays')
    expect(closedDaysLabel(HOURS.pool!, tMy)).toBe('တနင်္လာနေ့ ပိတ်သည်')
    expect(closedDaysLabel(HOURS.games!, tEn)).toBeNull()
  })
})
