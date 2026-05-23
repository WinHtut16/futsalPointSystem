/**
 * Business-logic suite for points and redemption routes.
 *
 * Tests call through full route handlers with a controllable Supabase mock,
 * simulating any DB state without a real connection.
 *
 * Strategy for the DB mock:
 *   - `mockRpc` is a plain vi.fn() — configure with .mockResolvedValueOnce()
 *     per test for the atomic RPCs (redeem_reward_direct, approve_redemption).
 *   - `queryQueue` is a shared FIFO — push results in call order; each
 *     .single() / .maybySingle() terminal call pops the next entry.
 *   - Fire-and-forget chains (.update().eq()) return the chain object
 *     synchronously; since the routes discard those results, this is safe.
 *
 * Concurrency tests use Promise.all to fire two requests simultaneously.
 * The RPC mock returns success for the first call and a race error for the
 * second, verifying the route surfaces DB rejection as HTTP 400 (not 500).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { calculatePoints, POINTS_PER_HOUR } from '@/lib/points'

// ---------------------------------------------------------------------------
// Auth state — mutated per-test via as.*() helpers
// ---------------------------------------------------------------------------
type Role = 'customer' | 'admin' | 'superadmin'
type FakeUser = { id: string; role: Role; total_points: number } | null

const authState: { user: FakeUser } = { user: null }

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(async () => authState.user),
  requireRole: vi.fn(async (role: Role) => {
    if (!authState.user || authState.user.role !== role) throw new Error('Unauthorized')
    return authState.user
  }),
  requireAnyAdmin: vi.fn(async () => {
    if (!authState.user || !['admin', 'superadmin'].includes(authState.user.role))
      throw new Error('Unauthorized')
    return authState.user
  }),
  requireSuperAdmin: vi.fn(async () => {
    if (!authState.user || authState.user.role !== 'superadmin') throw new Error('Unauthorized')
    return authState.user
  }),
}))

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------
type DbResult = { data?: unknown; error?: { message: string; code?: string } | null }

// Shared queue; tests push results in the order the route will consume them.
const queryQueue: DbResult[] = []

// Build a fresh chainable mock that shares the queue. Every terminal call
// (.single, .maybySingle, .maybySingle) pops the next entry.
function makeChain() {
  const next = () => {
    const r = queryQueue.shift() ?? {}
    return { data: r.data ?? null, error: r.error ?? null }
  }
  const chain: Record<string, unknown> = {
    single:      vi.fn(async () => next()),
    maybySingle: vi.fn(async () => next()),  // supabase-js v2 spelling used in this codebase
    maybeSingle: vi.fn(async () => next()),  // guard against either spelling
  }
  for (const m of ['select', 'eq', 'neq', 'order', 'limit',
                   'insert', 'update', 'upsert', 'delete', 'lt', 'gt']) {
    chain[m] = vi.fn(() => chain)
  }
  return chain
}

const mockRpc = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() => ({ rpc: mockRpc, from: vi.fn(() => makeChain()) })),
  createClient: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Constants and helpers
// ---------------------------------------------------------------------------
const REWARD_ID  = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const REQUEST_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const CUSTOMER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const ADMIN_ID   = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

function asCustomer(total_points = 0) {
  authState.user = { id: CUSTOMER_ID, role: 'customer', total_points }
}
function asAdmin() {
  authState.user = { id: ADMIN_ID, role: 'admin', total_points: 0 }
}

function jsonReq(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

const routeParams = (id: string) => ({ params: Promise.resolve({ id }) })

/** Push DB query results that .single()/.maybySingle() will pop in order. */
function mockQuery(...results: DbResult[]) { queryQueue.push(...results) }

/** Configure RPC mock for the next N calls. */
function mockRpcOnce(...results: DbResult[]) {
  for (const r of results) {
    mockRpc.mockResolvedValueOnce({ data: r.data ?? null, error: r.error ?? null })
  }
}

beforeEach(() => {
  authState.user = null
  queryQueue.length = 0
  mockRpc.mockReset()
})

// ============================================================================
// (1 & 2) POST /api/points/redeem — direct customer redemption
//
// This route delegates entirely to the redeem_reward_direct RPC. Balance and
// stock checks are atomic inside the DB function; the route maps exception
// messages to HTTP status codes.
// ============================================================================
describe('POST /api/points/redeem', () => {
  const url = 'http://t/api/points/redeem'
  const body = { reward_id: REWARD_ID }

  it('(1) succeeds when customer has exactly enough points', async () => {
    asCustomer(100)
    mockRpcOnce({ data: null, error: null })            // RPC succeeds
    mockQuery({ data: { total_points: 0 } })            // post-deduction profile read

    const { POST } = await import('@/app/api/points/redeem/route')
    const res = await POST(jsonReq(url, 'POST', body))

    expect(res.status).toBe(200)
    expect((await res.json()).total_points).toBe(0)
  })

  it('(2) returns 400 when balance is insufficient', async () => {
    asCustomer(10)
    mockRpcOnce({ error: { message: 'insufficient_points' } })

    const { POST } = await import('@/app/api/points/redeem/route')
    const res = await POST(jsonReq(url, 'POST', body))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Not enough points.')
  })

  it('(3) succeeds when redeeming the last item in stock', async () => {
    asCustomer(50)
    mockRpcOnce({ data: null, error: null })            // RPC atomically sets stock to 0
    mockQuery({ data: { total_points: 0 } })

    const { POST } = await import('@/app/api/points/redeem/route')
    const res = await POST(jsonReq(url, 'POST', body))

    expect(res.status).toBe(200)
    expect((await res.json()).total_points).toBe(0)
  })

  it('(4) returns 400 when stock is already 0', async () => {
    asCustomer(100)
    mockRpcOnce({ error: { message: 'out_of_stock' } })

    const { POST } = await import('@/app/api/points/redeem/route')
    const res = await POST(jsonReq(url, 'POST', body))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Reward is out of stock.')
  })

  it('returns 404 when reward does not exist or is inactive', async () => {
    asCustomer(999)
    mockRpcOnce({ error: { message: 'reward_unavailable' } })

    const { POST } = await import('@/app/api/points/redeem/route')
    const res = await POST(jsonReq(url, 'POST', body))

    expect(res.status).toBe(404)
  })
})

// ============================================================================
// POST /api/redemptions — create pending request (pre-checks run in JS)
//
// DB call order per request:
//   1. from('rewards').select('*').eq('id').single()
//   2. from('redemption_requests').select('id')...maybySingle()  [if stock+balance OK]
//   3. from('redemption_requests').insert(...).select().single() [if no duplicate]
// ============================================================================
describe('POST /api/redemptions (pending request flow)', () => {
  const url = 'http://t/api/redemptions'
  const body = { reward_id: REWARD_ID }
  const activeReward = { id: REWARD_ID, name: 'Prize', points_cost: 50, stock: 5, is_active: true }

  it('(1) creates a pending request when balance and stock are sufficient', async () => {
    asCustomer(50)
    mockQuery(
      { data: activeReward },
      { data: null },                                   // no existing pending
      { data: { id: REQUEST_ID, status: 'pending', customer_id: CUSTOMER_ID, reward_id: REWARD_ID } },
    )

    const { POST } = await import('@/app/api/redemptions/route')
    const res = await POST(jsonReq(url, 'POST', body))

    expect(res.status).toBe(201)
    expect((await res.json()).status).toBe('pending')
  })

  it('(2) returns 400 when customer has insufficient points', async () => {
    asCustomer(30)                                      // needs 50
    mockQuery({ data: activeReward })

    const { POST } = await import('@/app/api/redemptions/route')
    const res = await POST(jsonReq(url, 'POST', body))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Not enough points.')
  })

  it('(3) succeeds when claiming the last item in stock (stock = 1)', async () => {
    asCustomer(100)
    mockQuery(
      { data: { ...activeReward, stock: 1 } },
      { data: null },
      { data: { id: REQUEST_ID, status: 'pending', customer_id: CUSTOMER_ID, reward_id: REWARD_ID } },
    )

    const { POST } = await import('@/app/api/redemptions/route')
    const res = await POST(jsonReq(url, 'POST', body))

    expect(res.status).toBe(201)
  })

  it('(4) returns 400 when stock is 0', async () => {
    asCustomer(100)
    mockQuery({ data: { ...activeReward, stock: 0 } })

    const { POST } = await import('@/app/api/redemptions/route')
    const res = await POST(jsonReq(url, 'POST', body))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Reward is out of stock.')
  })

  it('returns 404 when reward is inactive', async () => {
    asCustomer(100)
    mockQuery({ data: { ...activeReward, is_active: false } })

    const { POST } = await import('@/app/api/redemptions/route')
    const res = await POST(jsonReq(url, 'POST', body))

    expect(res.status).toBe(404)
  })

  it('returns 409 when a pending request already exists (app-level duplicate check)', async () => {
    asCustomer(100)
    mockQuery(
      { data: activeReward },
      { data: { id: 'existing-req' } },                // duplicate found
    )

    const { POST } = await import('@/app/api/redemptions/route')
    const res = await POST(jsonReq(url, 'POST', body))

    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/pending request/)
  })

  it('returns 409 on unique index violation (DB-level race guard, SQLSTATE 23505)', async () => {
    asCustomer(100)
    mockQuery(
      { data: activeReward },
      { data: null },                                   // app-level check passes...
      { data: null, error: { code: '23505', message: 'unique_violation' } }, // ...DB rejects
    )

    const { POST } = await import('@/app/api/redemptions/route')
    const res = await POST(jsonReq(url, 'POST', body))

    expect(res.status).toBe(409)
  })
})

// ============================================================================
// PATCH /api/redemptions/[id] approve — delegates to approve_redemption RPC
//
// The RPC holds the row lock and performs all checks atomically; the route
// only maps exception messages to HTTP responses.
// ============================================================================
describe('PATCH /api/redemptions/[id] — approve', () => {
  const url  = 'http://t/api/redemptions/x'
  const body = { action: 'approve' }

  it('(1) succeeds when customer has exactly enough points', async () => {
    asAdmin()
    mockRpcOnce({ data: null, error: null })

    const { PATCH } = await import('@/app/api/redemptions/[id]/route')
    const res = await PATCH(jsonReq(url, 'PATCH', body), routeParams(REQUEST_ID))

    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)
  })

  it('(2) returns 400 when customer balance is now insufficient', async () => {
    asAdmin()
    mockRpcOnce({ error: { message: 'insufficient_points' } })

    const { PATCH } = await import('@/app/api/redemptions/[id]/route')
    const res = await PATCH(jsonReq(url, 'PATCH', body), routeParams(REQUEST_ID))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Customer no longer has enough points.')
  })

  it('(3) succeeds when approving the last item in stock', async () => {
    asAdmin()
    mockRpcOnce({ data: null, error: null })            // RPC atomically sets stock to 0

    const { PATCH } = await import('@/app/api/redemptions/[id]/route')
    const res = await PATCH(jsonReq(url, 'PATCH', body), routeParams(REQUEST_ID))

    expect(res.status).toBe(200)
  })

  it('(4) returns 400 when reward is now out of stock', async () => {
    asAdmin()
    mockRpcOnce({ error: { message: 'out_of_stock' } })

    const { PATCH } = await import('@/app/api/redemptions/[id]/route')
    const res = await PATCH(jsonReq(url, 'PATCH', body), routeParams(REQUEST_ID))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Reward is now out of stock.')
  })

  it('returns 400 when request is no longer pending (double-approval protection)', async () => {
    asAdmin()
    mockRpcOnce({ error: { message: 'not_pending' } })

    const { PATCH } = await import('@/app/api/redemptions/[id]/route')
    const res = await PATCH(jsonReq(url, 'PATCH', body), routeParams(REQUEST_ID))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Only pending requests can be actioned.')
  })

  it('returns 404 when the redemption request does not exist', async () => {
    asAdmin()
    mockRpcOnce({ error: { message: 'request_not_found' } })

    const { PATCH } = await import('@/app/api/redemptions/[id]/route')
    const res = await PATCH(jsonReq(url, 'PATCH', body), routeParams(REQUEST_ID))

    expect(res.status).toBe(404)
  })

  it('passes optional notes through to the RPC', async () => {
    asAdmin()
    mockRpcOnce({ data: null, error: null })

    const { PATCH } = await import('@/app/api/redemptions/[id]/route')
    await PATCH(
      jsonReq(url, 'PATCH', { action: 'approve', notes: 'Verified in person' }),
      routeParams(REQUEST_ID),
    )

    expect(mockRpc).toHaveBeenCalledWith('approve_redemption', expect.objectContaining({
      p_notes: 'Verified in person',
    }))
  })
})

// ============================================================================
// (5) Concurrent redemption invariants
//
// In a single-threaded JS environment, Promise.all schedules both handlers
// concurrently. The RPC mock is configured to succeed for the first call and
// return a race error for the second. We verify:
//   - exactly one 200 and one 400 are returned (sorted comparison)
//   - both paths complete without throwing
//
// This tests the HTTP-layer invariant: the route never returns 500 or crashes
// when the DB signals a race condition. The DB-level correctness (no negative
// balance, no negative stock) is enforced by the atomic SQL functions tested
// separately.
// ============================================================================
describe('(5) Concurrent redemption invariants', () => {
  it('two simultaneous direct redeems: one succeeds, one gets 400 insufficient_points', async () => {
    asCustomer(100)
    mockRpcOnce(
      { data: null, error: null },                         // first RPC call → success
      { data: null, error: { message: 'insufficient_points' } }, // second → race reject
    )
    mockQuery({ data: { total_points: 0 } })               // only the winner fetches profile

    const { POST } = await import('@/app/api/points/redeem/route')
    const fire = () => POST(jsonReq('http://t/api/points/redeem', 'POST', { reward_id: REWARD_ID }))
    const [r1, r2] = await Promise.all([fire(), fire()])

    const statuses = [r1.status, r2.status].sort((a, b) => a - b)
    expect(statuses).toEqual([200, 400])

    const bodies = await Promise.all([r1.json(), r2.json()])
    const errors = bodies.filter(b => b.error).map(b => b.error)
    expect(errors).toEqual(['Not enough points.'])
  })

  it('two simultaneous approvals of the same request: one succeeds, one gets 400 not_pending', async () => {
    asAdmin()
    mockRpcOnce(
      { data: null, error: null },
      { data: null, error: { message: 'not_pending' } },
    )

    const { PATCH } = await import('@/app/api/redemptions/[id]/route')
    const fire = () => PATCH(
      jsonReq('http://t/api/redemptions/x', 'PATCH', { action: 'approve' }),
      routeParams(REQUEST_ID),
    )
    const [r1, r2] = await Promise.all([fire(), fire()])

    const statuses = [r1.status, r2.status].sort((a, b) => a - b)
    expect(statuses).toEqual([200, 400])

    const bodies = await Promise.all([r1.json(), r2.json()])
    const errors = bodies.filter(b => b.error).map(b => b.error)
    expect(errors).toEqual(['Only pending requests can be actioned.'])
  })

  it('two simultaneous redeems of a single-stock item: one succeeds, one gets 400 out_of_stock', async () => {
    asCustomer(200)
    mockRpcOnce(
      { data: null, error: null },
      { data: null, error: { message: 'out_of_stock' } },
    )
    mockQuery({ data: { total_points: 150 } })             // only the winner fetches profile

    const { POST } = await import('@/app/api/points/redeem/route')
    const fire = () => POST(jsonReq('http://t/api/points/redeem', 'POST', { reward_id: REWARD_ID }))
    const [r1, r2] = await Promise.all([fire(), fire()])

    const statuses = [r1.status, r2.status].sort((a, b) => a - b)
    expect(statuses).toEqual([200, 400])

    // Exactly 2 RPC calls were made — stock was never decremented twice
    expect(mockRpc).toHaveBeenCalledTimes(2)
    expect(mockRpc).toHaveBeenCalledWith('redeem_reward_direct', expect.objectContaining({
      p_customer_id: CUSTOMER_ID,
      p_reward_id:   REWARD_ID,
    }))
  })

  it('two simultaneous pending-request creations: one 201, one 409 from unique index', async () => {
    asCustomer(100)
    const reward = { id: REWARD_ID, points_cost: 50, stock: 5, is_active: true }
    // Promise.all fires both handlers concurrently.  In the JS microtask queue
    // the two handlers interleave step-by-step (FIFO), so the consumption
    // order across 3 await-points per request is:
    //   req1-rewardFetch, req2-rewardFetch,
    //   req1-dupCheck,    req2-dupCheck,
    //   req1-insert,      req2-insert
    // Both pass the app-level duplicate check (race window); the DB unique
    // partial index then rejects the second insert with SQLSTATE 23505.
    mockQuery(
      { data: reward },     // req1: reward fetch
      { data: reward },     // req2: reward fetch  ← must mirror req1 (same step)
      { data: null },       // req1: no duplicate found
      { data: null },       // req2: no duplicate found
      { data: { id: REQUEST_ID, status: 'pending', customer_id: CUSTOMER_ID, reward_id: REWARD_ID } },
      { data: null, error: { code: '23505', message: 'unique_violation' } },
    )

    const { POST } = await import('@/app/api/redemptions/route')
    const fire = () => POST(jsonReq('http://t/api/redemptions', 'POST', { reward_id: REWARD_ID }))
    const [r1, r2] = await Promise.all([fire(), fire()])

    const statuses = [r1.status, r2.status].sort((a, b) => a - b)
    expect(statuses).toEqual([201, 409])
  })
})

// ============================================================================
// calculatePoints (lib/points.ts) — pure function, no mocks needed
// ============================================================================
describe('calculatePoints (lib/points.ts)', () => {
  it('returns 0 for 0 hours', () => {
    expect(calculatePoints(0)).toBe(0)
  })

  it('returns POINTS_PER_HOUR for 1 hour', () => {
    expect(calculatePoints(1)).toBe(POINTS_PER_HOUR)
  })

  it('returns 100 for 10 hours', () => {
    expect(calculatePoints(10)).toBe(100)
  })

  it('rounds correctly for fractional hours (1.5h → 15 pts)', () => {
    expect(calculatePoints(1.5)).toBe(15)
  })

  it('handles fractional result via Math.round (0.33h)', () => {
    expect(calculatePoints(0.33)).toBe(Math.round(0.33 * POINTS_PER_HOUR))
  })
})

// ============================================================================
// POST /api/points/add — success path
//
// DB call order:
//   1. from('profiles').select('id, role').eq('id').single()  → customer lookup
//   2. rpc('add_points_transaction', ...)                     → atomic increment
//   3. from('profiles').select('total_points').eq('id').single() → updated balance
// ============================================================================
describe('POST /api/points/add — success path', () => {
  const url = 'http://t/api/points/add'

  it('returns points_added and updated total_points', async () => {
    asAdmin()
    mockQuery(
      { data: { id: CUSTOMER_ID, role: 'customer' } },  // customer lookup
      { data: { total_points: 520 } },                   // updated balance
    )
    mockRpcOnce({ data: null, error: null })

    const { POST } = await import('@/app/api/points/add/route')
    const res = await POST(jsonReq(url, 'POST', { customer_id: CUSTOMER_ID, hours_played: 2 }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.points_added).toBe(20)       // 2h × 10 pts/hr
    expect(body.total_points).toBe(520)
  })

  it('returns 404 when customer not found', async () => {
    asAdmin()
    mockQuery({ data: null })                // customer lookup returns null

    const { POST } = await import('@/app/api/points/add/route')
    const res = await POST(jsonReq(url, 'POST', { customer_id: CUSTOMER_ID, hours_played: 1 }))

    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('Customer not found.')
    expect(mockRpc).not.toHaveBeenCalled()
  })
})

// ============================================================================
// PATCH /api/redemptions/[id] — reject branch
//
// The reject path does NOT call the approve_redemption RPC; it reads the row
// directly, checks status, then fires a fire-and-forget update.
//
// DB call order:
//   1. from('redemption_requests').select('status').eq('id').single() → req fetch
//   2. from('redemption_requests').update(...).eq('id')               → fire-and-forget
// ============================================================================
describe('PATCH /api/redemptions/[id] — reject', () => {
  const url  = 'http://t/api/redemptions/x'
  const body = { action: 'reject' }

  it('(1) returns 200 and does NOT call RPC for a pending request', async () => {
    asAdmin()
    mockQuery({ data: { status: 'pending' } })

    const { PATCH } = await import('@/app/api/redemptions/[id]/route')
    const res = await PATCH(jsonReq(url, 'PATCH', body), routeParams(REQUEST_ID))

    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('(2) returns 404 when request not found', async () => {
    asAdmin()
    mockQuery({ data: null })

    const { PATCH } = await import('@/app/api/redemptions/[id]/route')
    const res = await PATCH(jsonReq(url, 'PATCH', body), routeParams(REQUEST_ID))

    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('Request not found.')
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('(3) returns 400 when request is already actioned (not pending)', async () => {
    asAdmin()
    mockQuery({ data: { status: 'approved' } })

    const { PATCH } = await import('@/app/api/redemptions/[id]/route')
    const res = await PATCH(jsonReq(url, 'PATCH', body), routeParams(REQUEST_ID))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Only pending requests can be actioned.')
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('(4) optional notes are accepted', async () => {
    asAdmin()
    mockQuery({ data: { status: 'pending' } })

    const { PATCH } = await import('@/app/api/redemptions/[id]/route')
    const res = await PATCH(
      jsonReq(url, 'PATCH', { action: 'reject', notes: 'Out of stock' }),
      routeParams(REQUEST_ID),
    )

    expect(res.status).toBe(200)
    expect(mockRpc).not.toHaveBeenCalled()
  })
})

// ============================================================================
// POST /api/redemptions — soft-deleted reward
//
// The route returns 404 when reward.is_active is falsy, which covers both
// manually deactivated and soft-deleted (is_deleted=true) rewards.
// ============================================================================
describe('POST /api/redemptions — soft-deleted reward', () => {
  const url  = 'http://t/api/redemptions'
  const body = { reward_id: REWARD_ID }

  it('returns 404 when reward is soft-deleted (is_active=false, is_deleted=true)', async () => {
    asCustomer(100)
    mockQuery({
      data: { id: REWARD_ID, name: 'Prize', points_cost: 50, stock: 5, is_active: false, is_deleted: true },
    })

    const { POST } = await import('@/app/api/redemptions/route')
    const res = await POST(jsonReq(url, 'POST', body))

    expect(res.status).toBe(404)
  })
})
