import { describe, it, expect } from 'vitest'
import { CUSTOMER_BUSINESSES, FUTSAL, parseBusiness } from '@/lib/points'

describe('parseBusiness (/account?biz=, /register?from=, history ?app=)', () => {
  it.each(['futsal', 'game', 'billiards'])('accepts %s', (b) => {
    expect(parseBusiness(b)).toBe(b)
  })
  it.each([null, undefined, '', 'gaming', 'GAME', 'billiards ', "game'--"])('falls back to futsal for %p', (b) => {
    expect(parseBusiness(b as string | null | undefined)).toBe(FUTSAL)
  })
  it('lists the three businesses in display order', () => {
    expect(CUSTOMER_BUSINESSES).toEqual(['futsal', 'game', 'billiards'])
  })
})
