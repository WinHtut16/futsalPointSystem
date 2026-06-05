/**
 * Customer CANCEL action + ownership enforcement + approve-when-customer-gone edge case.
 *
 * Covers:
 *   - PATCH /api/redemptions/[id] {action:'cancel'} — success, already-resolved, not-found, forbidden
 *   - Edge case: admin APPROVE when RPC returns customer_not_found → non-200
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
    // Support `await chain` for update().eq().select() returning patterns (PTS-2/PTS-7)
    then:        vi.fn((resolve: (v: unknown) => void) => resolve(next())),
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
const CUSTOMER_ID       = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const OTHER_CUSTOMER_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const ADMIN_ID          = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const REQUEST_ID        = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

function asCustomer() { authState.user = { id: CUSTOMER_ID, role: 'customer', total_points: 100 } }
function asAdmin()    { authState.user = { id: ADMIN_ID,    role: 'admin',    total_points: 0 } }

function mockQuery(...results: DbResult[]) { queryQueue.push(...results) }
function mockRpcOnce(...results: DbResult[]) {
  for (const r of results) {
    mockRpc.mockResolvedValueOnce({ data: r.data ?? null, error: r.error ?? null })
  }
}

function patch(body: unknown) {
  return new NextRequest('http://t/api/redemptions/r1', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function routeParams(id: string) { return { params: Promise.resolve({ id }) } }

beforeEach(() => {
  authState.user = null
  queryQueue.length = 0
  mockRpc.mockReset()
})

// ===========================================================================
// PATCH /api/redemptions/[id] — customer cancel
// ===========================================================================
describe('PATCH /api/redemptions/[id] — customer cancel', () => {
  it('customer cancels own pending request → 200 {success:true}, RPC not called', async () => {
    asCustomer()
    // Route: SELECT {customer_id, status} → status check → ownership check → UPDATE
    // PTS-2: UPDATE uses .eq('status','pending').select('id'); non-empty result → 200
    mockQuery(
      { data: { status: 'pending', customer_id: CUSTOMER_ID } }, // SELECT
      { data: [{ id: REQUEST_ID }] },                             // UPDATE returning id (1 row)
    )

    const { PATCH } = await import('@/app/api/redemptions/[id]/route')
    const res = await PATCH(patch({ action: 'cancel' }), routeParams(REQUEST_ID))

    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)
    expect(mockRpc).not.toHaveBeenCalled() // cancel uses direct update, not RPC
  })

  it('TOCTOU: approve committed between cancel SELECT and UPDATE → 409 (PTS-2 fix)', async () => {
    // Simulates: cancel SELECT reads 'pending' (check passes), but approve_redemption
    // commits status='approved' before cancel UPDATE fires. The UPDATE's
    // .eq('status','pending') finds 0 matching rows → cancelled is [] → 409.
    asCustomer()
    mockQuery(
      { data: { status: 'pending', customer_id: CUSTOMER_ID } }, // SELECT sees 'pending'
      { data: [] },                                               // UPDATE: 0 rows (already approved)
    )

    const { PATCH } = await import('@/app/api/redemptions/[id]/route')
    const res = await PATCH(patch({ action: 'cancel' }), routeParams(REQUEST_ID))

    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/already been actioned/)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('cancel already-resolved request → 400 "Only pending requests can be actioned."', async () => {
    asCustomer()
    // Route checks status BEFORE ownership — status:approved fires 400 first
    mockQuery({ data: { status: 'approved', customer_id: CUSTOMER_ID } })

    const { PATCH } = await import('@/app/api/redemptions/[id]/route')
    const res = await PATCH(patch({ action: 'cancel' }), routeParams(REQUEST_ID))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Only pending requests can be actioned.')
  })

  it('cancel non-existent request → 404', async () => {
    asCustomer()
    mockQuery({ data: null })

    const { PATCH } = await import('@/app/api/redemptions/[id]/route')
    const res = await PATCH(patch({ action: 'cancel' }), routeParams(REQUEST_ID))

    expect(res.status).toBe(404)
  })

  it('customer cancels another customer\'s request → 404 (ownership hidden)', async () => {
    asCustomer() // user.id = CUSTOMER_ID
    // Returns 404, not 403, to avoid leaking that the request exists but isn't theirs
    mockQuery({ data: { status: 'pending', customer_id: OTHER_CUSTOMER_ID } })

    const { PATCH } = await import('@/app/api/redemptions/[id]/route')
    const res = await PATCH(patch({ action: 'cancel' }), routeParams(REQUEST_ID))

    expect(res.status).toBe(404)
  })
})

// ===========================================================================
// Edge case — approve when customer no longer exists
// ===========================================================================
describe('PATCH /api/redemptions/[id] — approve when customer gone', () => {
  it('approve_redemption RPC returns customer_not_found → non-200 response', async () => {
    // The approve path calls rpc('approve_redemption') directly (no from() queries).
    // customer_not_found is not explicitly mapped in the route, so it falls through to 500.
    asAdmin()
    mockRpcOnce({ error: { message: 'customer_not_found' } })

    const { PATCH } = await import('@/app/api/redemptions/[id]/route')
    const res = await PATCH(patch({ action: 'approve' }), routeParams(REQUEST_ID))

    // Route maps known errors to 400/404; unknown errors fall through to 500
    expect(res.status).not.toBe(200)
  })
})
