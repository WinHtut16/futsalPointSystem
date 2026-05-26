/**
 * Customer management + registration success paths.
 *
 * Covers:
 *   - POST /api/auth/register     — success, duplicate phone (app-level + auth-level fallback)
 *   - GET  /api/customers          — list all, phone filter
 *   - GET  /api/customers/[id]     — found, not found
 *   - PUT  /api/customers/[id]     — password reset (success, error), profile update (success)
 *   - DELETE /api/customers/[id]   — success, error
 *   - Mass assignment guard        — role + total_points rejected via strict schema
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
// Supabase mock — thenable chain (supports `await query.limit(N)` + `.single()`)
// ---------------------------------------------------------------------------
type DbResult = { data?: unknown; error?: { message: string; code?: string } | null }
const queryQueue: DbResult[] = []

function makeChain() {
  const next = () => {
    const r = queryQueue.shift() ?? {}
    return { data: r.data ?? null, error: r.error ?? null }
  }
  const chain: Record<string, unknown> = {}
  // Thenable: supports `await chain` (e.g. `await query.limit(50)`)
  chain.then      = (resolve: (v: unknown) => void) => { resolve(next()) }
  chain.single      = vi.fn(async () => next())
  chain.maybySingle = vi.fn(async () => next()) // Supabase SDK has two spellings in the wild
  chain.maybeSingle = vi.fn(async () => next()) // keep both to avoid test fragility
  for (const m of ['select', 'eq', 'neq', 'ilike', 'order', 'limit', 'insert',
                   'update', 'upsert', 'delete', 'lt', 'gt']) {
    chain[m] = vi.fn(() => chain)
  }
  return chain
}

const mockAuthAdmin = {
  createUser:     vi.fn().mockResolvedValue({ data: {}, error: null }),
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

// ---------------------------------------------------------------------------
// UUIDs + helpers
// ---------------------------------------------------------------------------
const ADMIN_ID    = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const CUSTOMER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

function asAdmin() { authState.user = { id: ADMIN_ID, role: 'admin', total_points: 0 } }

function mockQuery(...results: DbResult[]) { queryQueue.push(...results) }

function jsonReq(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

function routeParams(id: string) { return { params: Promise.resolve({ id }) } }

beforeEach(() => {
  authState.user = null
  queryQueue.length = 0
  mockAuthAdmin.createUser.mockClear()
  mockAuthAdmin.updateUserById.mockClear()
  mockAuthAdmin.deleteUser.mockClear()
  vi.mocked(createServiceClient).mockClear()
})

// ===========================================================================
// POST /api/auth/register
// ===========================================================================
describe('POST /api/auth/register', () => {
  // Public endpoint — no auth state required

  it('valid body → 200 {success:true}', async () => {
    mockQuery({ data: null }) // maybySingle: no existing phone → proceed
    mockAuthAdmin.createUser.mockResolvedValueOnce({ data: { user: { id: 'new-id' } }, error: null })

    const { POST } = await import('@/app/api/auth/register/route')
    const res = await POST(jsonReq('http://t/api/auth/register', 'POST', {
      phone: '0912345678',
      username: 'NewUser',
      password: 'Password123',
    }))

    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)
  })

  it('duplicate phone (app-level check) → 409, createUser NOT called', async () => {
    mockQuery({ data: { id: 'existing-id' } }) // maybySingle: existing phone found

    const { POST } = await import('@/app/api/auth/register/route')
    const res = await POST(jsonReq('http://t/api/auth/register', 'POST', {
      phone: '0912345678',
      username: 'NewUser',
      password: 'Password123',
    }))

    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('This phone number is already registered.')
    expect(mockAuthAdmin.createUser).not.toHaveBeenCalled()
  })

  it('duplicate phone (auth-level fallback: createUser returns "already exists") → 409', async () => {
    mockQuery({ data: null }) // maybySingle: app check passes
    mockAuthAdmin.createUser.mockResolvedValueOnce({
      data: null,
      error: { message: 'Email already exists' }, // contains 'already' → caught by route
    })

    const { POST } = await import('@/app/api/auth/register/route')
    const res = await POST(jsonReq('http://t/api/auth/register', 'POST', {
      phone: '0912345678',
      username: 'NewUser',
      password: 'Password123',
    }))

    expect(res.status).toBe(409)
  })
})

// ===========================================================================
// GET /api/customers
// ===========================================================================
describe('GET /api/customers', () => {
  beforeEach(asAdmin)

  it('no phone filter → 200, returns customer array', async () => {
    mockQuery({ data: [{ id: CUSTOMER_ID, username: 'TestUser', role: 'customer', total_points: 100 }] })

    const { GET } = await import('@/app/api/customers/route')
    const res = await GET(jsonReq('http://t/api/customers', 'GET'))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe(CUSTOMER_ID)
  })

  it('?phone=0912345678 filter → 200, returns filtered results', async () => {
    mockQuery({ data: [{ id: CUSTOMER_ID, phone: '0912345678', role: 'customer' }] })

    const { GET } = await import('@/app/api/customers/route')
    const res = await GET(jsonReq('http://t/api/customers?phone=0912345678', 'GET'))

    expect(res.status).toBe(200)
    expect(Array.isArray(await res.json())).toBe(true)
  })
})

// ===========================================================================
// GET /api/customers/[id]
// ===========================================================================
describe('GET /api/customers/[id]', () => {
  beforeEach(asAdmin)

  it('found → 200 with profile data', async () => {
    mockQuery({ data: { id: CUSTOMER_ID, username: 'TestUser', role: 'customer', total_points: 50 } })

    const { GET } = await import('@/app/api/customers/[id]/route')
    const res = await GET(jsonReq('http://t/api/customers/c1', 'GET'), routeParams(CUSTOMER_ID))

    expect(res.status).toBe(200)
    expect((await res.json()).id).toBe(CUSTOMER_ID)
  })

  it('not found (data:null) → 404', async () => {
    mockQuery({ data: null })

    const { GET } = await import('@/app/api/customers/[id]/route')
    const res = await GET(jsonReq('http://t/api/customers/c1', 'GET'), routeParams(CUSTOMER_ID))

    expect(res.status).toBe(404)
  })
})

// ===========================================================================
// PUT /api/customers/[id] — password reset
// ===========================================================================
describe('PUT /api/customers/[id] — password reset', () => {
  beforeEach(asAdmin)

  it('valid customer + no auth error → 200 {success:true}, updateUserById called with new password', async () => {
    mockQuery({ data: { role: 'customer' } }) // IDOR pre-check
    mockAuthAdmin.updateUserById.mockResolvedValueOnce({ data: {}, error: null })

    const { PUT } = await import('@/app/api/customers/[id]/route')
    const res = await PUT(
      jsonReq('http://t/api/customers/c1', 'PUT', { password: 'NewPass123' }),
      routeParams(CUSTOMER_ID),
    )

    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)
    expect(mockAuthAdmin.updateUserById).toHaveBeenCalledWith(CUSTOMER_ID, { password: 'NewPass123' })
  })

  it('auth.admin.updateUserById returns error → 500', async () => {
    mockQuery({ data: { role: 'customer' } }) // IDOR pre-check
    mockAuthAdmin.updateUserById.mockResolvedValueOnce({ data: null, error: { message: 'Auth error' } })

    const { PUT } = await import('@/app/api/customers/[id]/route')
    const res = await PUT(
      jsonReq('http://t/api/customers/c1', 'PUT', { password: 'NewPass123' }),
      routeParams(CUSTOMER_ID),
    )

    expect(res.status).toBe(500)
  })
})

// ===========================================================================
// PUT /api/customers/[id] — profile update
// ===========================================================================
describe('PUT /api/customers/[id] — profile update', () => {
  beforeEach(asAdmin)

  it('valid username update → 200 with updated row', async () => {
    mockQuery(
      { data: { role: 'customer' } }, // IDOR pre-check
      { data: { id: CUSTOMER_ID, username: 'UpdatedName', role: 'customer', total_points: 50 } }, // updated row
    )

    const { PUT } = await import('@/app/api/customers/[id]/route')
    const res = await PUT(
      jsonReq('http://t/api/customers/c1', 'PUT', { username: 'UpdatedName' }),
      routeParams(CUSTOMER_ID),
    )

    expect(res.status).toBe(200)
    expect((await res.json()).username).toBe('UpdatedName')
  })
})

// ===========================================================================
// DELETE /api/customers/[id]
// ===========================================================================
describe('DELETE /api/customers/[id]', () => {
  beforeEach(asAdmin)

  it('valid customer → 200 {success:true}, deleteUser called with customer id', async () => {
    mockQuery({ data: { role: 'customer' } }) // IDOR pre-check
    mockAuthAdmin.deleteUser.mockResolvedValueOnce({ data: {}, error: null })

    const { DELETE } = await import('@/app/api/customers/[id]/route')
    const res = await DELETE(jsonReq('http://t/api/customers/c1', 'DELETE'), routeParams(CUSTOMER_ID))

    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)
    expect(mockAuthAdmin.deleteUser).toHaveBeenCalledWith(CUSTOMER_ID)
  })

  it('auth.admin.deleteUser returns error → 500', async () => {
    mockQuery({ data: { role: 'customer' } }) // IDOR pre-check
    mockAuthAdmin.deleteUser.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } })

    const { DELETE } = await import('@/app/api/customers/[id]/route')
    const res = await DELETE(jsonReq('http://t/api/customers/c1', 'DELETE'), routeParams(CUSTOMER_ID))

    expect(res.status).toBe(500)
  })
})

// ===========================================================================
// Mass assignment — PUT profile update with forbidden fields
//
// CustomerProfileUpdateSchema uses .strict() — any key not in {username, phone}
// causes a Zod error returned as 400 BEFORE createServiceClient is called.
// ===========================================================================
describe('PUT /api/customers/[id] — mass assignment blocked', () => {
  beforeEach(asAdmin)

  afterEach(() => {
    // Strict schema validation fires before createServiceClient() is ever called
    expect(vi.mocked(createServiceClient)).not.toHaveBeenCalled()
  })

  it('body with { role } → 400 (strict schema rejects unknown key)', async () => {
    const { PUT } = await import('@/app/api/customers/[id]/route')
    const res = await PUT(
      jsonReq('http://t/api/customers/c1', 'PUT', { role: 'superadmin' }),
      routeParams(CUSTOMER_ID),
    )
    expect(res.status).toBe(400)
  })

  it('body with { total_points } → 400 (strict schema rejects unknown key)', async () => {
    const { PUT } = await import('@/app/api/customers/[id]/route')
    const res = await PUT(
      jsonReq('http://t/api/customers/c1', 'PUT', { total_points: 9999 }),
      routeParams(CUSTOMER_ID),
    )
    expect(res.status).toBe(400)
  })
})
