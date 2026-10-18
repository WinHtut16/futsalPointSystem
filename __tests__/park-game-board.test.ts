import { describe, it, expect } from 'vitest'
import { toBoardStation } from '@/lib/park/game-board'

const row = (over: Partial<{ name: string; tier: string; status: string; state: string }> = {}) => ({
  name: 'TV 3',
  tier: 'PS4',
  status: 'available',
  state: 'free',
  ...over,
})

describe('toBoardStation (game.stations row -> public board)', () => {
  it('maps a free numbered screen', () => {
    expect(toBoardStation(row())).toEqual({ id: 'tv3', n: 3, tier: 'PS4', status: 'free' })
  })

  it('maps occupied to busy and reserved to reserved', () => {
    expect(toBoardStation(row({ state: 'occupied' }))?.status).toBe('busy')
    expect(toBoardStation(row({ state: 'reserved' }))?.status).toBe('reserved')
  })

  it('maintenance outranks any session state', () => {
    expect(toBoardStation(row({ status: 'maintenance', state: 'occupied' }))?.status).toBe('maintenance')
  })

  it('maps the VIP room without a number', () => {
    expect(toBoardStation(row({ name: 'VIP', tier: 'VIP' }))).toEqual({ id: 'vip', n: null, tier: 'VIP', status: 'free' })
  })

  it('accepts a lower-case tier', () => {
    expect(toBoardStation(row({ name: 'TV 8', tier: 'ps5' }))?.tier).toBe('PS5')
  })

  it('drops rows it cannot place on the plan', () => {
    expect(toBoardStation(row({ tier: 'Switch' }))).toBeNull()
    expect(toBoardStation(row({ name: 'Corner screen' }))).toBeNull()
  })
})
