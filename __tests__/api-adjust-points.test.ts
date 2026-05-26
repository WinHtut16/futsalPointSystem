/**
 * POST /api/points/adjust
 *
 * Covers:
 *   - Privilege guard: unauthenticated + customer callers blocked (Supabase never reached)
 *   - Input validation: all AdjustPointsSchema fields validated before DB
 *   - Business logic: positive/negative/zero-result adjustments, balance-guard, unknown customer
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Auth state
// ---------------------------------------------------------------------------
type Role = 'customer' | 'admin' | 'superadmin'
type FakeUser = { id: string; role: Role; total_points: number } | null

const authState: { user: FakeUser } = { user: null }

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(async () => authState.user),
  requireRole: vi.fn(async (role: Role | Role[]) => {
    const roles = Array.isArray(role) ? role : [role]
    if (!authState.user || !roles.includes(authState.user.role)) throw new Error('Unauthorized')
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
// Supabase mock — queue-based FIFO for .single() terminal calls
// ---------------------------------------------------------------------------
type DbResult = { data?: unknown; error?: { message: string; code?: string } | null }
const queryQueue: DbResult[] = []

function makeChain() {
  const next = () => {
    const r = queryQueue.shift() ?? {}
    return { data: r.data ?? null, error: r.error ?? null }
  }
  const chain: Record<string, unknown> = {
    single:      vi.fn(async () => next()),
    maybySingle: vi.fn(async () => next()), // Supabase SDK has two spellings in the wild
    maybeSingle: vi.fn(async () => next()), // keep both to avoid test fragility
  }
  for (const m of ['select', 'eq', 'neq', 'order', 'limit', 'insert',
                   'update', 'upsert', 'delete', 'lt', 'gt']) {
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
// UUIDs + helpers
// ---------------------------------------------------------------------------
const ADMIN_ID    = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const CUSTOMER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

function asAdmin()    { authState.user = { id: ADMIN_ID,    role: 'admin',    total_points: 0 } }
function asCustomer(total_points = 0) { authState.user = { id: CUSTOMER_ID, role: 'customer', total_points } }

function mockQuery(...results: DbResult[]) { queryQueue.push(...results) }
function mockRpcOnce(...results: DbResult[]) {
  for (const r of results) {
    mockRpc.mockResolvedValueOnce({ data: r.data ?? null, error: r.error ?? null })
  }
}

function post(body: unknown) {
  return new NextRequest('http://t/api/points/adjust', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  authState.user = null
  queryQueue.length = 0
  mockRpc.mockReset()
  vi.mocked(createServiceClient).mockClear()
})

// ===========================================================================
// Privilege guard
// ===========================================================================
describe('POST /api/points/adjust — privilege guard', () => {
  afterEach(() => {
    expect(vi.mocked(createServiceClient)).not.toHaveBeenCalled()
  })

  it('unauthenticated → 401', async () => {
    const { POST } = await import('@/app/api/points/adjust/route')
    const res = await POST(post({ customer_id: CUSTOMER_ID, points_delta: 10, reason: 'test' }))
    expect([401, 403]).toContain(res.status)
  })

  it('customer caller → 401/403', async () => {
    asCustomer()
    const { POST } = await import('@/app/api/points/adjust/route')
    const res = await POST(post({ customer_id: CUSTOMER_ID, points_delta: 10, reason: 'test' }))
    expect([401, 403]).toContain(res.status)
  })
})

// ===========================================================================
// Validation — Supabase must not be reached
// ===========================================================================
describe('POST /api/points/adjust — validation', () => {
  beforeEach(asAdmin)

  afterEach(() => {
    expect(vi.mocked(createServiceClient)).not.toHaveBeenCalled()
  })

  it('missing customer_id → 400', async () => {
    const { POST } = await import('@/app/api/points/adjust/route')
    const res = await POST(post({ points_delta: 10, reason: 'fix' }))
    expect(res.status).toBe(400)
  })

  it('non-uuid customer_id → 400', async () => {
    const { POST } = await import('@/app/api/points/adjust/route')
    const res = await POST(post({ customer_id: 'not-a-uuid', points_delta: 10, reason: 'fix' }))
    expect(res.status).toBe(400)
  })

  it('SQL injection in customer_id → 400', async () => {
    const { POST } = await import('@/app/api/points/adjust/route')
    const res = await POST(post({ customer_id: "' OR 1=1 --", points_delta: 10, reason: 'fix' }))
    expect(res.status).toBe(400)
  })

  it('zero points_delta → 400', async () => {
    const { POST } = await import('@/app/api/points/adjust/route')
    const res = await POST(post({ customer_id: CUSTOMER_ID, points_delta: 0, reason: 'fix' }))
    expect(res.status).toBe(400)
  })

  it('points_delta > 10,000 → 400', async () => {
    const { POST } = await import('@/app/api/points/adjust/route')
    const res = await POST(post({ customer_id: CUSTOMER_ID, points_delta: 10001, reason: 'fix' }))
    expect(res.status).toBe(400)
  })

  it('points_delta < -10,000 → 400', async () => {
    const { POST } = await import('@/app/api/points/adjust/route')
    const res = await POST(post({ customer_id: CUSTOMER_ID, points_delta: -10001, reason: 'fix' }))
    expect(res.status).toBe(400)
  })

  it('missing reason → 400', async () => {
    const { POST } = await import('@/app/api/points/adjust/route')
    const res = await POST(post({ customer_id: CUSTOMER_ID, points_delta: 10 }))
    expect(res.status).toBe(400)
  })

  it('empty reason (whitespace-only) → 400', async () => {
    // AdjustPointsSchema.reason uses .trim().min(1) — whitespace trims to '' → fails
    const { POST } = await import('@/app/api/points/adjust/route')
    const res = await POST(post({ customer_id: CUSTOMER_ID, points_delta: 10, reason: '   ' }))
    expect(res.status).toBe(400)
  })

  it('reason > 500 chars → 400', async () => {
    const { POST } = await import('@/app/api/points/adjust/route')
    const res = await POST(post({ customer_id: CUSTOMER_ID, points_delta: 10, reason: 'x'.repeat(501) }))
    expect(res.status).toBe(400)
  })
})

// ===========================================================================
// Business logic
// ===========================================================================
describe('POST /api/points/adjust — business logic', () => {
  beforeEach(asAdmin)

  it('positive adjustment: +50 on balance 100 → 200, {points_delta:50, total_points:150}', async () => {
    mockQuery(
      { data: { id: CUSTOMER_ID, role: 'customer', total_points: 100 } }, // customer lookup
      { data: { total_points: 150 } },                                      // updated balance
    )
    mockRpcOnce({ data: null, error: null })

    const { POST } = await import('@/app/api/points/adjust/route')
    const res = await POST(post({ customer_id: CUSTOMER_ID, points_delta: 50, reason: 'bonus' }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.points_delta).toBe(50)
    expect(body.total_points).toBe(150)
  })

  it('negative adjustment: -30 on balance 100 → 200, {points_delta:-30, total_points:70}', async () => {
    mockQuery(
      { data: { id: CUSTOMER_ID, role: 'customer', total_points: 100 } },
      { data: { total_points: 70 } },
    )
    mockRpcOnce({ data: null, error: null })

    const { POST } = await import('@/app/api/points/adjust/route')
    const res = await POST(post({ customer_id: CUSTOMER_ID, points_delta: -30, reason: 'correction' }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.points_delta).toBe(-30)
    expect(body.total_points).toBe(70)
  })

  it('exact-zero result: -100 on balance 100 → 200, total_points:0 (zero is allowed)', async () => {
    mockQuery(
      { data: { id: CUSTOMER_ID, role: 'customer', total_points: 100 } },
      { data: { total_points: 0 } },
    )
    mockRpcOnce({ data: null, error: null })

    const { POST } = await import('@/app/api/points/adjust/route')
    const res = await POST(post({ customer_id: CUSTOMER_ID, points_delta: -100, reason: 'full deduct' }))

    expect(res.status).toBe(200)
    expect((await res.json()).total_points).toBe(0)
  })

  it('balance would go negative: -101 on balance 100 → 400, RPC not called', async () => {
    // Route guard: if (customer.total_points + points_delta < 0) → 400
    mockQuery({ data: { id: CUSTOMER_ID, role: 'customer', total_points: 100 } })

    const { POST } = await import('@/app/api/points/adjust/route')
    const res = await POST(post({ customer_id: CUSTOMER_ID, points_delta: -101, reason: 'overdraft' }))

    expect(res.status).toBe(400)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('non-existent customer → 404, RPC not called', async () => {
    mockQuery({ data: null })

    const { POST } = await import('@/app/api/points/adjust/route')
    const res = await POST(post({ customer_id: CUSTOMER_ID, points_delta: 10, reason: 'test' }))

    expect(res.status).toBe(404)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('non-customer target (role:admin) → 404, RPC not called', async () => {
    mockQuery({ data: { id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', role: 'admin', total_points: 0 } })

    const { POST } = await import('@/app/api/points/adjust/route')
    const res = await POST(post({ customer_id: CUSTOMER_ID, points_delta: 10, reason: 'test' }))

    expect(res.status).toBe(404)
    expect(mockRpc).not.toHaveBeenCalled()
  })
})
