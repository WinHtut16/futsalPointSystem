import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const state: { user: { id: string; role: string } | null } = { user: null }
const rpc = vi.fn()

vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn(async () => state.user) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => ({ rpc })) }))

import { GET } from '@/app/api/account/sessions/route'

const get = (q: string) => GET(new NextRequest(new URL(`/api/account/sessions${q}`, 'http://localhost:3000')))

function rows(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `s${i}`,
    played_at: new Date(Date.UTC(2026, 10, 1, 12) - i * 3_600_000).toISOString(),
    place: 'TV 1',
    paid_minutes: 60,
    voided: false,
    points: 10,
  }))
}

describe('GET /api/account/sessions', () => {
  beforeEach(() => {
    state.user = { id: 'u1', role: 'customer' }
    rpc.mockReset()
  })

  it('401 when signed out', async () => {
    state.user = null
    expect((await get('?app=game')).status).toBe(401)
    expect(rpc).not.toHaveBeenCalled()
  })

  it.each(['', '?app=futsal', '?app=GAME'])('400 for business %p', async (q) => {
    expect((await get(q)).status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('400 for a bad cursor', async () => {
    expect((await get('?app=game&before=yesterday')).status).toBe(400)
  })

  it('asks for one extra row and pages on played_at', async () => {
    rpc.mockResolvedValue({ data: rows(21), error: null })
    const res = await get('?app=billiards&before=2026-11-02T00:00:00Z')
    expect(rpc).toHaveBeenCalledWith('my_venue_sessions', {
      p_app: 'billiards',
      p_before: '2026-11-02T00:00:00Z',
      p_limit: 21,
    })
    const body = await res.json()
    expect(body.items).toHaveLength(20)
    expect(body.hasMore).toBe(true)
    expect(body.nextCursor).toBe(body.items[19].played_at)
  })

  it('last page has no cursor', async () => {
    rpc.mockResolvedValue({ data: rows(3), error: null })
    const body = await (await get('?app=game')).json()
    expect(body).toMatchObject({ hasMore: false, nextCursor: null })
    expect(body.items).toHaveLength(3)
  })

  it('500 when the database refuses', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect((await get('?app=game')).status).toBe(500)
  })
})
