import { describe, it, expect } from 'vitest'
import { CUSTOMER_BUSINESSES, FUTSAL, parseBusiness } from '@/lib/points'
import { withBusinessBalance } from '@/lib/loyalty'

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

describe('withBusinessBalance (admin request cards)', () => {
  const row = (wallets: { app: string; balance: number }[] | undefined) => ({
    id: 'r1',
    customer: { username: 'a', phone: '09', total_points: 999, wallets },
  })

  it('shows the balance at the business being managed, not the futsal total', () => {
    const [r] = withBusinessBalance([row([{ app: 'futsal', balance: 999 }, { app: 'game', balance: 40 }])], 'game')
    expect(r.customer?.total_points).toBe(40)
  })
  it('no wallet at that business means 0', () => {
    const [r] = withBusinessBalance([row([{ app: 'futsal', balance: 999 }])], 'billiards')
    expect(r.customer?.total_points).toBe(0)
  })
  it('drops the embedded wallets from the row', () => {
    const [r] = withBusinessBalance([row([])], 'game')
    expect(r.customer && 'wallets' in r.customer).toBe(false)
  })
  it('handles null', () => {
    expect(withBusinessBalance(null, 'game')).toEqual([])
  })
})
