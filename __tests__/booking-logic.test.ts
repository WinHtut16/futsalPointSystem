import { describe, it, expect } from 'vitest'
import {
  MAX_SLOTS,
  BOOKING_LEAD_MINUTES,
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
  isSlotBookable,
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
  it('is a flat 10,000 MMK regardless of slot count', () => {
    expect(depositFor(1)).toBe(10000)
    expect(depositFor(MAX_SLOTS)).toBe(10000)
  })
})

describe('isSlotBookable', () => {
  it(`allows booking when slot is >= ${BOOKING_LEAD_MINUTES} minutes away`, () => {
    // now = 10:30 MMT = 04:00 UTC; slot 11:00 MMT = 04:30 UTC → 30 min away
    const now = new Date('2026-06-01T04:00:00.000Z')
    expect(isSlotBookable('2026-06-01', 11, now)).toBe(true)
  })

  it('blocks booking when slot is < 5 minutes away', () => {
    // now = 10:56 MMT = 04:26 UTC; slot 11:00 MMT = 04:30 UTC → 4 min away
    const now = new Date('2026-06-01T04:26:00.000Z')
    expect(isSlotBookable('2026-06-01', 11, now)).toBe(false)
  })

  it('blocks booking for a slot that has already started', () => {
    // now = 11:30 MMT = 05:00 UTC; slot 11:00 MMT = 04:30 UTC → past
    const now = new Date('2026-06-01T05:00:00.000Z')
    expect(isSlotBookable('2026-06-01', 11, now)).toBe(false)
  })

  it('allows booking exactly at the 5-minute boundary', () => {
    // now = 10:55 MMT = 04:25 UTC; slot 11:00 MMT = 04:30 UTC → exactly 5 min
    const now = new Date('2026-06-01T04:25:00.000Z')
    expect(isSlotBookable('2026-06-01', 11, now)).toBe(true)
  })
})

describe('canCancel', () => {
  // now = midnight UTC = 06:30 Myanmar
  const now = new Date('2026-06-06T00:00:00.000Z')

  it('allows cancel when slot is 12+ hours away (Myanmar-timezone-aware)', () => {
    // slot 19 Myanmar = 19:00 MMT - 6:30 = 12:30 UTC → 12.5h from midnight UTC
    expect(canCancel('2026-06-06', 19, now)).toBe(true)
  })

  it('blocks cancel within the 12-hour window (Myanmar-timezone-aware)', () => {
    // slot 18 Myanmar = 18:00 MMT - 6:30 = 11:30 UTC → 11.5h from midnight UTC
    expect(canCancel('2026-06-06', 18, now)).toBe(false)
  })

  it('blocks cancel for a slot already in the past', () => {
    // later = 20:00 UTC; slot 8 Myanmar = 08:00 MMT - 6:30 = 01:30 UTC → past
    const later = new Date('2026-06-06T20:00:00.000Z')
    expect(canCancel('2026-06-06', 8, later)).toBe(false)
  })
})
