import { describe, it, expect } from 'vitest'
import {
  MAX_SLOTS,
  TIER_PRICE,
  weekdayOf,
  isWeekend,
  isThingyan,
  isWeekendRate,
  tierForHour,
  priceForHour,
  formatHourRange,
  dayHours,
  depositFor,
  canCancel,
} from '@/lib/booking'

// Reference dates (2026):
//   2026-06-01 = Monday    (weekday)
//   2026-06-06 = Saturday  (weekend)
//   2026-06-07 = Sunday    (weekend)
//   2026-04-14 = Tuesday   (Thingyan holiday)

describe('weekdayOf', () => {
  it('is timezone-stable (uses UTC calendar fields)', () => {
    expect(weekdayOf('2026-06-01')).toBe(1) // Monday
    expect(weekdayOf('2026-06-06')).toBe(6) // Saturday
    expect(weekdayOf('2026-06-07')).toBe(0) // Sunday
  })
})

describe('isWeekend', () => {
  it('flags Saturday and Sunday only', () => {
    expect(isWeekend('2026-06-06')).toBe(true)
    expect(isWeekend('2026-06-07')).toBe(true)
    expect(isWeekend('2026-06-01')).toBe(false)
  })
})

describe('isThingyan', () => {
  it('matches Apr 13–16 inclusive', () => {
    expect(isThingyan('2026-04-13')).toBe(true)
    expect(isThingyan('2026-04-16')).toBe(true)
    expect(isThingyan('2026-04-12')).toBe(false)
    expect(isThingyan('2026-04-17')).toBe(false)
  })
})

describe('isWeekendRate', () => {
  it('is true for weekends and Thingyan, false for plain weekdays', () => {
    expect(isWeekendRate('2026-06-06')).toBe(true) // Sat
    expect(isWeekendRate('2026-04-14')).toBe(true) // Thingyan (a Tuesday)
    expect(isWeekendRate('2026-06-01')).toBe(false) // Mon
  })
})

describe('tierForHour / priceForHour', () => {
  it('weekday morning slots (6–13) = 20,000', () => {
    expect(tierForHour('2026-06-01', 6)).toBe('morning')
    expect(tierForHour('2026-06-01', 13)).toBe('morning')
    expect(priceForHour('2026-06-01', 8)).toBe(TIER_PRICE.morning)
  })

  it('weekday evening slots (14–21) = 25,000', () => {
    expect(tierForHour('2026-06-01', 14)).toBe('evening')
    expect(tierForHour('2026-06-01', 21)).toBe('evening')
    expect(priceForHour('2026-06-01', 19)).toBe(TIER_PRICE.evening)
  })

  it('weekend = 30,000 flat all day', () => {
    expect(tierForHour('2026-06-06', 8)).toBe('weekend')
    expect(tierForHour('2026-06-06', 20)).toBe('weekend')
    expect(priceForHour('2026-06-06', 8)).toBe(TIER_PRICE.weekend)
  })

  it('Thingyan weekday is charged at weekend rate', () => {
    expect(tierForHour('2026-04-14', 8)).toBe('weekend')
    expect(priceForHour('2026-04-14', 8)).toBe(30000)
  })
})

describe('formatHourRange', () => {
  it('zero-pads and shows the one-hour range', () => {
    expect(formatHourRange(6)).toBe('06:00 – 07:00')
    expect(formatHourRange(21)).toBe('21:00 – 22:00')
  })
})

describe('dayHours', () => {
  it('returns 16 start-hours from 6 to 21', () => {
    const hours = dayHours()
    expect(hours).toHaveLength(16)
    expect(hours[0]).toBe(6)
    expect(hours[hours.length - 1]).toBe(21)
  })
})

describe('depositFor', () => {
  it('is 10,000 per slot', () => {
    expect(depositFor(1)).toBe(10000)
    expect(depositFor(MAX_SLOTS)).toBe(20000)
  })
})

describe('canCancel', () => {
  const now = new Date('2026-06-06T00:00:00.000Z')

  it('allows cancel when slot is 12+ hours away', () => {
    // 14:00 UTC on the same day is 14h after midnight UTC
    expect(canCancel('2026-06-06', 14, now)).toBe(true)
  })

  it('blocks cancel within the 12-hour window', () => {
    // 10:00 UTC is only 10h away
    expect(canCancel('2026-06-06', 10, now)).toBe(false)
  })

  it('blocks cancel for a slot already in the past', () => {
    const later = new Date('2026-06-06T20:00:00.000Z')
    expect(canCancel('2026-06-06', 8, later)).toBe(false)
  })
})
