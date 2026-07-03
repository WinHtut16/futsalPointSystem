/**
 * IDOR (Insecure Direct Object Reference) guard tests.
 *
 * Verifies that admin-facing endpoints enforce that the target user has the
 * correct role before executing sensitive operations (password reset, delete,
 * profile read).
 *
 * Covers:
 *   - GET  /api/customers/[id]     — must 404 for non-customer IDs
 *   - PUT  /api/customers/[id]     — must 404 for non-customer IDs (no cross-role password reset / profile update)
 *   - DELETE /api/customers/[id]  — must 404 for non-customer IDs (no cross-role delete)
 *   - PUT  /api/admin/staff/[id]   — must 404 for non-admin IDs (no cross-role password reset)
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
    if (!authState.user) throw new Error('UNAUTHENTICATED')
    if (!roles.includes(authState.user.role)) throw new Error('FORBIDDEN')
    return authState.user
  }),
  requireAnyAdmin: vi.fn(async () => {
    if (!authState.user) throw new Error('UNAUTHENTICATED')
    if (!['admin', 'superadmin'].includes(authState.user.role)) throw new Error('FORBIDDEN')
    return authState.user
  }),
  requireSuperAdmin: vi.fn(async () => {
    if (!authState.user) throw new Error('UNAUTHENTICATED')
    if (authState.user.role !== 'superadmin') throw new Error('FORBIDDEN')
    return authState.user
  }),
}))

// ---------------------------------------------------------------------------
// Supabase mock — queue-based terminal calls, chainable builders
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
    maybySingle: vi.fn(async () => next()),
    maybeSingle: vi.fn(async () => next()),
  }
  for (const m of ['select', 'eq', 'neq', 'order', 'limit', 'insert', 'update', 'upsert', 'delete', 'lt', 'gt']) {
    chain[m] = vi.fn(() => chain)
  }
  return chain
}

const mockAuthAdmin = {
  updateUserById: vi.fn().mockResolvedValue({ data: {}, error: null }),
  deleteUser:     vi.fn().mockResolvedValue({ data: {}, error: null }),
}

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => makeChain()),
    auth: { admin: mockAuthAdmin },
  })),
  createClient: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))

// ---------------------------------------------------------------------------
// UUIDs and helpers
// ---------------------------------------------------------------------------
const ADMIN_UUID      = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const SUPERADMIN_UUID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const CUSTOMER_UUID   = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const CALLER_ID       = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

function asAdmin()      { authState.user = { id: CALLER_ID, role: 'admin',      total_points: 0 } }
function asSuperAdmin() { authState.user = { id: CALLER_ID, role: 'superadmin', total_points: 0 } }

function mockQuery(...results: DbResult[]) { queryQueue.push(...results) }

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

beforeEach(() => {
  authState.user = null
  queryQueue.length = 0
  mockAuthAdmin.updateUserById.mockClear()
  mockAuthAdmin.deleteUser.mockClear()
})

// ===========================================================================
// GET /api/customers/[id] — must 404 for non-customer target IDs
// ===========================================================================
describe('GET /api/customers/[id] — IDOR guard', () => {
  it('returns 404 when target is an admin account', async () => {
    asAdmin()
    // Role filter on query means non-customer row returns null
    mockQuery({ data: null })

    const { GET } = await import('@/app/api/customers/[id]/route')
    const res = await GET(jsonReq('http://t/api/customers/a1', 'GET'), routeParams(ADMIN_UUID))

    expect(res.status).toBe(404)
  })

  it('returns 404 when target is a superadmin account', async () => {
    asAdmin()
    mockQuery({ data: null })

    const { GET } = await import('@/app/api/customers/[id]/route')
    const res = await GET(jsonReq('http://t/api/customers/a1', 'GET'), routeParams(SUPERADMIN_UUID))

    expect(res.status).toBe(404)
  })
})

// ===========================================================================
// PUT /api/customers/[id] — must 404 for non-customer targets
// ===========================================================================
describe('PUT /api/customers/[id] — IDOR guard', () => {
  it('cannot reset password of an admin account — returns 404, auth op not called', async () => {
    asAdmin()
    mockQuery({ data: { id: ADMIN_UUID, role: 'admin' } })  // pre-check returns admin

    const { PUT } = await import('@/app/api/customers/[id]/route')
    const res = await PUT(
      jsonReq('http://t/api/customers/a1', 'PUT', { password: 'newpass12' }),
      routeParams(ADMIN_UUID)
    )

    expect(res.status).toBe(404)
    expect(mockAuthAdmin.updateUserById).not.toHaveBeenCalled()
  })

  it('cannot reset password of a superadmin account — returns 404, auth op not called', async () => {
    asAdmin()
    mockQuery({ data: { id: SUPERADMIN_UUID, role: 'superadmin' } })

    const { PUT } = await import('@/app/api/customers/[id]/route')
    const res = await PUT(
      jsonReq('http://t/api/customers/a1', 'PUT', { password: 'newpass12' }),
      routeParams(SUPERADMIN_UUID)
    )

    expect(res.status).toBe(404)
    expect(mockAuthAdmin.updateUserById).not.toHaveBeenCalled()
  })

  it('cannot update profile fields of a non-customer account', async () => {
    asAdmin()
    mockQuery({ data: { id: ADMIN_UUID, role: 'admin' } })

    const { PUT } = await import('@/app/api/customers/[id]/route')
    const res = await PUT(
      jsonReq('http://t/api/customers/a1', 'PUT', { username: 'hijacked' }),
      routeParams(ADMIN_UUID)
    )

    expect(res.status).toBe(404)
    expect(mockAuthAdmin.updateUserById).not.toHaveBeenCalled()
  })
})

// ===========================================================================
// DELETE /api/customers/[id] — must 404 for non-customer targets
// ===========================================================================
describe('DELETE /api/customers/[id] — IDOR guard', () => {
  it('cannot delete an admin account — returns 404, auth op not called', async () => {
    asAdmin()
    mockQuery({ data: { id: ADMIN_UUID, role: 'admin' } })

    const { DELETE } = await import('@/app/api/customers/[id]/route')
    const res = await DELETE(
      jsonReq('http://t/api/customers/a1', 'DELETE'),
      routeParams(ADMIN_UUID)
    )

    expect(res.status).toBe(404)
    expect(mockAuthAdmin.deleteUser).not.toHaveBeenCalled()
  })

  it('cannot delete a superadmin account — returns 404, auth op not called', async () => {
    asAdmin()
    mockQuery({ data: { id: SUPERADMIN_UUID, role: 'superadmin' } })

    const { DELETE } = await import('@/app/api/customers/[id]/route')
    const res = await DELETE(
      jsonReq('http://t/api/customers/a1', 'DELETE'),
      routeParams(SUPERADMIN_UUID)
    )

    expect(res.status).toBe(404)
    expect(mockAuthAdmin.deleteUser).not.toHaveBeenCalled()
  })
})

// ===========================================================================
// PUT /api/admin/staff/[id] — must 404 for non-admin targets
// ===========================================================================
describe('PUT /api/admin/staff/[id] — IDOR guard', () => {
  it('cannot reset password of a customer account — returns 404, auth op not called', async () => {
    asSuperAdmin()
    mockQuery({ data: { id: CUSTOMER_UUID, role: 'customer' } })

    const { PUT } = await import('@/app/api/admin/staff/[id]/route')
    const res = await PUT(
      jsonReq('http://t/api/admin/staff/c1', 'PUT', { password: 'newpass12' }),
      routeParams(CUSTOMER_UUID)
    )

    expect(res.status).toBe(404)
    expect(mockAuthAdmin.updateUserById).not.toHaveBeenCalled()
  })
})
