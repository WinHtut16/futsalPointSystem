import { describe, it, expect } from 'vitest'
import { VENUE_PORTAL, customerLanding, formatMinutes, isVenue, parseVenueSessions, settingsBackHref } from '@/lib/venue-account'

describe('venue portals', () => {
  it('maps each venue to its page', () => {
    expect(VENUE_PORTAL).toEqual({ game: '/games/account', billiards: '/billiards/account' })
  })
  it.each(['game', 'billiards'])('accepts %s', (v) => expect(isVenue(v)).toBe(true))
  it.each(['futsal', 'GAME', '', null, undefined, 3])('rejects %p', (v) => expect(isVenue(v)).toBe(false))
})

describe('settingsBackHref', () => {
  it.each(['/games/account', '/billiards/account'])('keeps %s', (b) => expect(settingsBackHref(b)).toBe(b))
  it.each([null, undefined, '', '/admin', 'https://evil.example', '//evil.example', '/games/account/../x'])(
    'falls back to /account for %p',
    (b) => expect(settingsBackHref(b as string | null | undefined)).toBe('/account')
  )
})

describe('parseVenueSessions', () => {
  it('keeps good rows and drops bad ones', () => {
    const rows = parseVenueSessions([
      { id: 's1', played_at: '2026-11-01T10:00:00Z', place: 'TV 3', paid_minutes: 125, voided: false, points: 20 },
      { id: 's2', played_at: '2026-11-01T09:00:00Z', place: null, paid_minutes: '30', voided: true, points: 0 },
      { id: 3, played_at: 'x' },
      null,
      'nope',
    ])
    expect(rows).toEqual([
      { id: 's1', played_at: '2026-11-01T10:00:00Z', place: 'TV 3', paid_minutes: 125, voided: false, points: 20 },
      { id: 's2', played_at: '2026-11-01T09:00:00Z', place: null, paid_minutes: 30, voided: true, points: 0 },
    ])
  })
  it('returns [] for non-arrays', () => {
    expect(parseVenueSessions(null)).toEqual([])
    expect(parseVenueSessions({})).toEqual([])
  })
})

describe('formatMinutes', () => {
  it.each([
    [0, '0m'],
    [45, '45m'],
    [60, '1h'],
    [135, '2h 15m'],
    [-5, '0m'],
  ])('%i -> %s', (m, out) => expect(formatMinutes(m)).toBe(out))
})

describe('customerLanding', () => {
  it('prefers a safe next', () => expect(customerLanding('/games/account?tab=sessions', 'billiards')).toBe('/games/account?tab=sessions'))
  it('drops an unsafe next', () => expect(customerLanding('//evil.example', 'game')).toBe('/account'))
  it('uses the venue from the QR code', () => expect(customerLanding(null, 'game')).toBe('/games/account'))
  it('defaults to /account', () => expect(customerLanding(null, 'nope')).toBe('/account'))
})
