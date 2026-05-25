import { describe, it, expect } from 'vitest'
import { formatDate, formatDateTime } from '@/lib/utils'

// UTC 2025-05-24T04:15:00Z = Myanmar (UTC+6:30) 2025-05-24 10:45 AM
const UTC_TIMESTAMP = '2025-05-24T04:15:00.000Z'

// UTC 2025-05-23T17:50:00Z = Myanmar (UTC+6:30) 2025-05-24 00:20 AM (next calendar day)
const NEAR_MIDNIGHT_UTC = '2025-05-23T17:50:00.000Z'

describe('formatDate', () => {
  it('formats date in Myanmar timezone', () => {
    expect(formatDate(UTC_TIMESTAMP)).toBe('24 May 2025')
  })

  it('uses Myanmar calendar day (not UTC day) near midnight', () => {
    // 5:50 PM UTC on May 23 is 12:20 AM May 24 in Myanmar (UTC+6:30) — should show May 24
    expect(formatDate(NEAR_MIDNIGHT_UTC)).toBe('24 May 2025')
  })
})

describe('formatDateTime', () => {
  it('formats date and time in Myanmar timezone with AM/PM', () => {
    expect(formatDateTime(UTC_TIMESTAMP)).toBe('24 May 2025, 10:45 am')
  })

  it('uses Myanmar calendar day near midnight', () => {
    expect(formatDateTime(NEAR_MIDNIGHT_UTC)).toBe('24 May 2025, 12:20 am')
  })
})
