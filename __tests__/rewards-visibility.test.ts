/**
 * Rewards visibility suite.
 *
 * Tests that:
 *   - GET /api/rewards adds `is_active=true` filter for customers but not for admins
 *   - PUT /api/rewards/[id] allows admin to toggle `is_active` but rejects full
 *     update from an admin (superadmin only)
 *
 * The GET handler awaits the query builder directly (`await query`), so the
 * mock chain must be thenable.  We capture the most recently created chain in
 * `lastChain` so individual tests can inspect which builder methods were called.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Auth state
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
// Supabase mock — trackable chain with thenable support
// ---------------------------------------------------------------------------
type DbResult = { data?: unknown; error?: { message: string; code?: string } | null }

const queryQueue: DbResult[] = []
let lastChain: Record<string, ReturnType<typeof vi.fn>> | null = null

function makeTrackableChain() {
  const next = () => {
    const r = queryQueue.shift() ?? {}
    return { data: r.data ?? null, error: r.error ?? null }
  }

  const chain: Record<string, unknown> = {}

  // Thenable: supports `await chain` — must be a plain function, not vi.fn(),
  // to avoid Promise.resolve() wrapping issues.
  chain.then = (resolve: (v: unknown) => void) => {
    resolve(next())
  }

  // Terminal methods
  chain.single = vi.fn(async () => next())
  chain.maybySingle = vi.fn(async () => next())
  chain.maybeSingle = vi.fn(async () => next())

  // Builder methods — all return chain so calls can be chained
  for (const m of ['select', 'eq', 'neq', 'order', 'limit', 'insert', 'update', 'delete', 'lt', 'gt', 'is', 'filter']) {
    chain[m] = vi.fn(() => chain)
  }

  lastChain = chain as Record<string, ReturnType<typeof vi.fn>>
  return chain
}

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => makeTrackableChain()),
  })),
  createClient: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const REWARD_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ADMIN_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const CUSTOMER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function asCustomer() {
  authState.user = { id: CUSTOMER_ID, role: 'customer', total_points: 100 }
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

function routeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

function mockQuery(...results: DbResult[]) {
  queryQueue.push(...results)
}

beforeEach(() => {
  authState.user = null
  queryQueue.length = 0
  lastChain = null
})

// ===========================================================================
// GET /api/rewards — role-based filtering
// ===========================================================================
describe('GET /api/rewards — role-based filtering', () => {
  it('adds is_active=true filter for customer role', async () => {
    asCustomer()
    mockQuery({
      data: [{ id: REWARD_ID, name: 'Prize', is_active: true, is_deleted: false, points_cost: 50 }],
    })

    const { GET } = await import('@/app/api/rewards/route')
    const res = await GET()

    expect(res.status).toBe(200)
    expect(lastChain!.eq).toHaveBeenCalledWith('is_active', true)
  })

  it('does not add is_active filter for admin role — returns inactive rewards too', async () => {
    asAdmin()
    mockQuery({
      data: [
        { id: 'r1', name: 'Active', is_active: true, points_cost: 50 },
        { id: 'r2', name: 'Inactive', is_active: false, points_cost: 100 },
      ],
    })

    const { GET } = await import('@/app/api/rewards/route')
    const res = await GET()

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(2)
    expect(lastChain!.eq).not.toHaveBeenCalledWith('is_active', true)
  })
})

// ===========================================================================
// PUT /api/rewards/[id] — admin toggle vs superadmin full-update
// ===========================================================================
describe('PUT /api/rewards/[id] — admin toggle vs superadmin full-update', () => {
  it('admin with toggle-only body { is_active } succeeds (200)', async () => {
    asAdmin()
    mockQuery({
      data: { id: REWARD_ID, name: 'Prize', is_active: false, points_cost: 50 },
    })

    const { PUT } = await import('@/app/api/rewards/[id]/route')
    const res = await PUT(
      jsonReq('http://t/api/rewards/r1', 'PUT', { is_active: false }),
      routeParams(REWARD_ID),
    )

    expect(res.status).toBe(200)
  })

  it('admin with full-update body returns 401/403', async () => {
    asAdmin()

    const { PUT } = await import('@/app/api/rewards/[id]/route')
    const res = await PUT(
      jsonReq('http://t/api/rewards/r1', 'PUT', { name: 'New Name', points_cost: 200 }),
      routeParams(REWARD_ID),
    )

    expect([401, 403]).toContain(res.status)
  })
})
