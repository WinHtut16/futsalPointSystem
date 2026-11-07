/**
 * /api/loyalty/<app>/... - game and billiards points & rewards admin.
 *
 * What must hold:
 *  - only game|billiards are valid businesses (futsal keeps its own routes)
 *  - the caller needs a grant for THAT business (app_role), and owner rank
 *    for creating / editing / deleting rewards and clearing history
 *  - every write is pinned to the business in the URL, so an id belonging to
 *    another business matches nothing
 * The real guard (lib/loyalty.server) runs; only its two inputs are mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

type Role = 'customer' | 'admin' | 'superadmin'
const state: {
  user: { id: string; role: Role } | null
  appRoles: Record<string, 'admin' | 'superadmin' | null>
} = { user: null, appRoles: {} }

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))
vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn(async () => state.user) }))
vi.mock('@/lib/apps.server', () => ({ getAppRole: vi.fn(async (app: string) => state.appRoles[app] ?? null) }))

// Chainable query mock: records every call, terminal calls pop a queue.
type Call = [string, ...unknown[]]
const calls: Call[] = []
const queue: { data?: unknown; error?: { message: string; code?: string } | null }[] = []
const next = () => {
  const r = queue.shift() ?? {}
  return { data: r.data ?? null, error: r.error ?? null }
}
function chain(): Record<string, unknown> {
  const c: Record<string, unknown> = {
    single: vi.fn(async () => next()),
    maybeSingle: vi.fn(async () => next()),
    then: (resolve: (v: unknown) => void) => resolve(next()),
  }
  for (const m of ['select', 'eq', 'in', 'order', 'limit', 'insert', 'update', 'delete']) {
    c[m] = vi.fn((...args: unknown[]) => {
      calls.push([m, ...args])
      return c
    })
  }
  return c
}
const rpc = vi.fn(async () => next())
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() => ({ from: vi.fn((t: string) => { calls.push(['from', t]); return chain() }), rpc })),
  createClient: vi.fn(),
}))

const ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const CUSTOMER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const req = (method: string, body?: unknown) =>
  new NextRequest('http://t/api/loyalty', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
const p = <T extends object>(v: T) => ({ params: Promise.resolve(v) })
const eqApp = (app: string) => calls.some((c) => c[0] === 'eq' && c[1] === 'app' && c[2] === app)

const reward = { name: 'Free hour', points_cost: 100 }

beforeEach(() => {
  calls.length = 0
  queue.length = 0
  rpc.mockClear()
  state.user = { id: 'staff-1', role: 'admin' }
  state.appRoles = {}
})

describe('business in the URL', () => {
  it('futsal is not a loyalty business here (404)', async () => {
    const { POST } = await import('@/app/api/loyalty/[app]/rewards/route')
    const res = await POST(req('POST', reward), p({ app: 'futsal' }))
    expect(res.status).toBe(404)
  })
  it('an unknown business is 404', async () => {
    const { POST } = await import('@/app/api/loyalty/[app]/rewards/route')
    const res = await POST(req('POST', reward), p({ app: 'gaming' }))
    expect(res.status).toBe(404)
  })
})

describe('POST rewards', () => {
  it('signed out: 401', async () => {
    state.user = null
    const { POST } = await import('@/app/api/loyalty/[app]/rewards/route')
    expect((await POST(req('POST', reward), p({ app: 'game' }))).status).toBe(401)
  })
  it('a customer: 403', async () => {
    state.user = { id: CUSTOMER, role: 'customer' }
    state.appRoles = { game: 'superadmin' }
    const { POST } = await import('@/app/api/loyalty/[app]/rewards/route')
    expect((await POST(req('POST', reward), p({ app: 'game' }))).status).toBe(403)
  })
  it('the billiards owner cannot create a game reward', async () => {
    state.appRoles = { billiards: 'superadmin' }
    const { POST } = await import('@/app/api/loyalty/[app]/rewards/route')
    expect((await POST(req('POST', reward), p({ app: 'game' }))).status).toBe(403)
    expect(calls).toEqual([])
  })
  it('a plain game admin cannot create a game reward', async () => {
    state.appRoles = { game: 'admin' }
    const { POST } = await import('@/app/api/loyalty/[app]/rewards/route')
    expect((await POST(req('POST', reward), p({ app: 'game' }))).status).toBe(403)
  })
  it('the game owner creates one, stamped with app=game from the URL', async () => {
    state.appRoles = { game: 'superadmin' }
    queue.push({ data: { id: ID } })
    const { POST } = await import('@/app/api/loyalty/[app]/rewards/route')
    // A smuggled "app" in the body is ignored: the business comes from the URL.
    const ok = await POST(req('POST', { ...reward, app: 'futsal' }), p({ app: 'game' }))
    expect(ok.status).toBe(201)
    const insert = calls.find((c) => c[0] === 'insert')
    expect((insert?.[1] as { app: string }).app).toBe('game')
  })
})

describe('PUT / DELETE rewards/[id]', () => {
  it('a game admin may switch a game reward on/off, pinned to app=game', async () => {
    state.appRoles = { game: 'admin' }
    queue.push({ data: { id: ID, is_active: false } })
    const { PUT } = await import('@/app/api/loyalty/[app]/rewards/[id]/route')
    const res = await PUT(req('PUT', { is_active: false }), p({ app: 'game', id: ID }))
    expect(res.status).toBe(200)
    expect(eqApp('game')).toBe(true)
  })
  it('an id from another business matches nothing: 404', async () => {
    state.appRoles = { game: 'admin' }
    queue.push({ data: null })
    const { PUT } = await import('@/app/api/loyalty/[app]/rewards/[id]/route')
    const res = await PUT(req('PUT', { is_active: false }), p({ app: 'game', id: ID }))
    expect(res.status).toBe(404)
  })
  it('a plain admin cannot edit the reward itself', async () => {
    state.appRoles = { billiards: 'admin' }
    const { PUT } = await import('@/app/api/loyalty/[app]/rewards/[id]/route')
    const res = await PUT(req('PUT', { points_cost: 1 }), p({ app: 'billiards', id: ID }))
    expect(res.status).toBe(403)
  })
  it('only the owner deletes, and only within the business', async () => {
    state.appRoles = { billiards: 'admin' }
    const { DELETE } = await import('@/app/api/loyalty/[app]/rewards/[id]/route')
    expect((await DELETE(req('DELETE'), p({ app: 'billiards', id: ID }))).status).toBe(403)

    state.appRoles = { billiards: 'superadmin' }
    queue.push({ data: { id: ID } })
    expect((await DELETE(req('DELETE'), p({ app: 'billiards', id: ID }))).status).toBe(200)
    expect(eqApp('billiards')).toBe(true)
  })
})

describe('PATCH redemptions/[id]', () => {
  it('a request of another business is not found, and nothing is approved', async () => {
    state.appRoles = { billiards: 'admin' }
    queue.push({ data: null }) // ownership check: not a billiards request
    const { PATCH } = await import('@/app/api/loyalty/[app]/redemptions/[id]/route')
    const res = await PATCH(req('PATCH', { action: 'approve' }), p({ app: 'billiards', id: ID }))
    expect(res.status).toBe(404)
    expect(rpc).not.toHaveBeenCalled()
  })
  it('a game admin approves a game request through approve_redemption', async () => {
    state.appRoles = { game: 'admin' }
    queue.push({ data: { id: ID } }, { data: null })
    const { PATCH } = await import('@/app/api/loyalty/[app]/redemptions/[id]/route')
    const res = await PATCH(req('PATCH', { action: 'approve' }), p({ app: 'game', id: ID }))
    expect(res.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('approve_redemption', expect.objectContaining({ p_request_id: ID }))
  })
  it('maps insufficient_points to a readable 400', async () => {
    state.appRoles = { game: 'admin' }
    queue.push({ data: { id: ID } }, { error: { message: 'insufficient_points' } })
    const { PATCH } = await import('@/app/api/loyalty/[app]/redemptions/[id]/route')
    const res = await PATCH(req('PATCH', { action: 'approve' }), p({ app: 'game', id: ID }))
    expect(res.status).toBe(400)
  })
  it('admins cannot "cancel" here (that is the customer\'s action)', async () => {
    state.appRoles = { game: 'admin' }
    const { PATCH } = await import('@/app/api/loyalty/[app]/redemptions/[id]/route')
    const res = await PATCH(req('PATCH', { action: 'cancel' }), p({ app: 'game', id: ID }))
    expect(res.status).toBe(400)
  })
})

describe('points/adjust', () => {
  it('writes to the business wallet named in the URL', async () => {
    state.appRoles = { billiards: 'admin' }
    queue.push({ data: { id: CUSTOMER, role: 'customer' } }, { data: null }, { data: { balance: 15 } })
    const { POST } = await import('@/app/api/loyalty/[app]/points/adjust/route')
    const res = await POST(
      req('POST', { customer_id: CUSTOMER, points_delta: 15, reason: 'missed session' }),
      p({ app: 'billiards' }),
    )
    expect(res.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('add_points_transaction', expect.objectContaining({ p_app: 'billiards', p_min_balance: 0 }))
    expect((await res.json()).total_points).toBe(15)
  })
  it('a game admin cannot adjust billiards points', async () => {
    state.appRoles = { game: 'admin' }
    const { POST } = await import('@/app/api/loyalty/[app]/points/adjust/route')
    const res = await POST(
      req('POST', { customer_id: CUSTOMER, points_delta: 15, reason: 'x' }),
      p({ app: 'billiards' }),
    )
    expect(res.status).toBe(403)
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe('redemptions/delete', () => {
  it('owner only, and pinned to the business', async () => {
    state.appRoles = { game: 'admin' }
    const { POST } = await import('@/app/api/loyalty/[app]/redemptions/delete/route')
    expect((await POST(req('POST', { ids: [ID] }), p({ app: 'game' }))).status).toBe(403)

    state.appRoles = { game: 'superadmin' }
    queue.push({ data: null })
    expect((await POST(req('POST', { ids: [ID] }), p({ app: 'game' }))).status).toBe(200)
    expect(eqApp('game')).toBe(true)
  })
})
