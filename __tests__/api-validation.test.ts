/**
 * Input-validation suite. Asserts every route returns 400 (never 500) for
 * malformed bodies/params: missing fields, wrong types, negative numbers,
 * overflow, empty strings, SQL/script injection.
 *
 * Auth is mocked to satisfy the role guard for each route — these tests
 * isolate validation. Supabase clients throw if invoked: a passing test
 * proves validation rejected the input *before* any DB call. (If validation
 * were missing, the route would reach the throwing mock, the catch would
 * surface as 401, and the `status === 400` assertion would fail.)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createServiceClient, createClient } from '@/lib/supabase/server'

type Role = 'customer' | 'admin' | 'superadmin'
type FakeUser = { id: string; role: Role; total_points: number } | null

const state: { user: FakeUser } = { user: null }

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(async () => state.user),
  requireRole: vi.fn(async (role: Role | Role[]) => {
    const roles = Array.isArray(role) ? role : [role]
    if (!state.user || !roles.includes(state.user.role)) throw new Error('Unauthorized')
    return state.user
  }),
  requireAnyAdmin: vi.fn(async () => {
    if (!state.user || !['admin', 'superadmin'].includes(state.user.role)) throw new Error('Unauthorized')
    return state.user
  }),
  requireSuperAdmin: vi.fn(async () => {
    if (!state.user || state.user.role !== 'superadmin') throw new Error('Unauthorized')
    return state.user
  }),
}))

vi.mock('@/lib/supabase/server', () => {
  const fail = () => {
    throw new Error('supabase reached — validation missing')
  }
  return { createClient: vi.fn(fail), createServiceClient: vi.fn(fail) }
})

beforeEach(() => {
  state.user = null
  vi.mocked(createServiceClient).mockClear()
  vi.mocked(createClient).mockClear()
})

afterEach(() => {
  expect(vi.mocked(createServiceClient)).not.toHaveBeenCalled()
  expect(vi.mocked(createClient)).not.toHaveBeenCalled()
})

const as = {
  customer: () => (state.user = { id: '11111111-1111-4111-8111-111111111111', role: 'customer', total_points: 9999 }),
  admin: () => (state.user = { id: '22222222-2222-4222-8222-222222222222', role: 'admin', total_points: 0 }),
  super: () => (state.user = { id: '33333333-3333-4333-8333-333333333333', role: 'superadmin', total_points: 0 }),
}

const VALID_UUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const SQLi = "' OR 1=1 --"
const XSS = '<script>alert(1)</script>'
const OVERFLOW = Number.MAX_VALUE
const HUGE_STR = 'x'.repeat(10_000)

function req(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}
const params = (id: string) => ({ params: Promise.resolve({ id }) })

async function expect400(res: Response) {
  expect(res.status).toBe(400)
  const body = await res.json()
  expect(body).toHaveProperty('error')
  expect(typeof body.error).toBe('string')
  expect(body.error.length).toBeGreaterThan(0)
}

// ===========================================================================
// /api/auth/register POST  (public)
// ===========================================================================
describe('POST /api/auth/register validation', () => {
  const url = 'http://t/api/auth/register'
  const valid = { phone: '0912345678', username: 'alice', password: 'secret123' }
  let POST: typeof import('@/app/api/auth/register/route').POST
  beforeEach(async () => { POST = (await import('@/app/api/auth/register/route')).POST })

  it('rejects empty body', async () => await expect400(await POST(req(url, 'POST', {}))))
  it('rejects missing phone', async () => await expect400(await POST(req(url, 'POST', { ...valid, phone: undefined }))))
  it('rejects wrong-type phone', async () => await expect400(await POST(req(url, 'POST', { ...valid, phone: 912345678 }))))
  it('rejects empty phone', async () => await expect400(await POST(req(url, 'POST', { ...valid, phone: '' }))))
  it('rejects SQL injection phone', async () => await expect400(await POST(req(url, 'POST', { ...valid, phone: SQLi }))))
  it('rejects script injection phone', async () => await expect400(await POST(req(url, 'POST', { ...valid, phone: XSS }))))
  it('rejects malformed phone', async () => await expect400(await POST(req(url, 'POST', { ...valid, phone: '12345' }))))

  it('rejects short username', async () => await expect400(await POST(req(url, 'POST', { ...valid, username: 'a' }))))
  it('rejects empty username', async () => await expect400(await POST(req(url, 'POST', { ...valid, username: '' }))))
  it('rejects wrong-type username', async () => await expect400(await POST(req(url, 'POST', { ...valid, username: 42 }))))
  it('rejects overflow-length username', async () => await expect400(await POST(req(url, 'POST', { ...valid, username: HUGE_STR }))))

  it('rejects short password', async () => await expect400(await POST(req(url, 'POST', { ...valid, password: 'abc' }))))
  it('rejects empty password', async () => await expect400(await POST(req(url, 'POST', { ...valid, password: '' }))))
  it('rejects wrong-type password', async () => await expect400(await POST(req(url, 'POST', { ...valid, password: 12345678 }))))
  it('rejects overflow-length password', async () => await expect400(await POST(req(url, 'POST', { ...valid, password: HUGE_STR }))))
})

// ===========================================================================
// /api/customers GET  (admin) — query param phone
// ===========================================================================
describe('GET /api/customers validation', () => {
  const base = 'http://t/api/customers'
  let GET: typeof import('@/app/api/customers/route').GET
  beforeEach(async () => {
    as.admin()
    GET = (await import('@/app/api/customers/route')).GET
  })

  it('rejects SQL injection in ?phone', async () => await expect400(await GET(req(`${base}?phone=${encodeURIComponent(SQLi)}`, 'GET'))))
  it('rejects script injection in ?phone', async () => await expect400(await GET(req(`${base}?phone=${encodeURIComponent(XSS)}`, 'GET'))))
  it('rejects LIKE-wildcard in ?phone', async () => await expect400(await GET(req(`${base}?phone=${encodeURIComponent('09%')}`, 'GET'))))
  it('rejects overflow ?phone', async () => await expect400(await GET(req(`${base}?phone=${'9'.repeat(50)}`, 'GET'))))
})

// ===========================================================================
// /api/customers/[id] PUT  (admin)
// ===========================================================================
describe('PUT /api/customers/[id] validation', () => {
  const url = 'http://t/api/customers/x'
  let PUT: typeof import('@/app/api/customers/[id]/route').PUT
  beforeEach(async () => {
    as.admin()
    PUT = (await import('@/app/api/customers/[id]/route')).PUT
  })

  it('rejects non-uuid id', async () => await expect400(await PUT(req(url, 'PUT', { phone: '0912345678' }), params('not-a-uuid'))))
  it('rejects SQL injection id', async () => await expect400(await PUT(req(url, 'PUT', { phone: '0912345678' }), params(SQLi))))
  it('rejects empty body', async () => await expect400(await PUT(req(url, 'PUT', {}), params(VALID_UUID))))
  it('rejects missing body', async () => await expect400(await PUT(req(url, 'PUT'), params(VALID_UUID))))
  it('rejects invalid phone format', async () => await expect400(await PUT(req(url, 'PUT', { phone: 'abc' }), params(VALID_UUID))))
  it('rejects empty phone string', async () => await expect400(await PUT(req(url, 'PUT', { phone: '' }), params(VALID_UUID))))
  it('rejects wrong-type password', async () => await expect400(await PUT(req(url, 'PUT', { password: 12345678 }), params(VALID_UUID))))
  it('rejects short password', async () => await expect400(await PUT(req(url, 'PUT', { password: 'short' }), params(VALID_UUID))))
})

// ===========================================================================
// /api/points/add POST  (admin)
// ===========================================================================
describe('POST /api/points/add validation', () => {
  const url = 'http://t/api/points/add'
  let POST: typeof import('@/app/api/points/add/route').POST
  beforeEach(async () => {
    as.admin()
    POST = (await import('@/app/api/points/add/route')).POST
  })

  it('rejects empty body', async () => await expect400(await POST(req(url, 'POST', {}))))
  it('rejects missing customer_id', async () => await expect400(await POST(req(url, 'POST', { hours_played: 1 }))))
  it('rejects non-uuid customer_id', async () => await expect400(await POST(req(url, 'POST', { customer_id: 'abc', hours_played: 1 }))))
  it('rejects SQL injection in customer_id', async () => await expect400(await POST(req(url, 'POST', { customer_id: SQLi, hours_played: 1 }))))
  it('rejects script injection in customer_id', async () => await expect400(await POST(req(url, 'POST', { customer_id: XSS, hours_played: 1 }))))
  it('rejects wrong-type hours_played', async () => await expect400(await POST(req(url, 'POST', { customer_id: VALID_UUID, hours_played: 'five' }))))
  it('rejects negative hours_played', async () => await expect400(await POST(req(url, 'POST', { customer_id: VALID_UUID, hours_played: -1 }))))
  it('rejects zero hours_played', async () => await expect400(await POST(req(url, 'POST', { customer_id: VALID_UUID, hours_played: 0 }))))
  it('rejects overflow hours_played', async () => await expect400(await POST(req(url, 'POST', { customer_id: VALID_UUID, hours_played: OVERFLOW }))))
  it('rejects empty-string customer_id', async () => await expect400(await POST(req(url, 'POST', { customer_id: '', hours_played: 1 }))))
})

// ===========================================================================
// /api/points/redeem POST  (customer)
// ===========================================================================
describe('POST /api/points/redeem validation', () => {
  const url = 'http://t/api/points/redeem'
  let POST: typeof import('@/app/api/points/redeem/route').POST
  beforeEach(async () => {
    as.customer()
    POST = (await import('@/app/api/points/redeem/route')).POST
  })

  it('rejects empty body', async () => await expect400(await POST(req(url, 'POST', {}))))
  it('rejects missing reward_id', async () => await expect400(await POST(req(url, 'POST', { foo: 'bar' }))))
  it('rejects non-uuid reward_id', async () => await expect400(await POST(req(url, 'POST', { reward_id: 'abc' }))))
  it('rejects SQL injection reward_id', async () => await expect400(await POST(req(url, 'POST', { reward_id: SQLi }))))
  it('rejects script injection reward_id', async () => await expect400(await POST(req(url, 'POST', { reward_id: XSS }))))
  it('rejects empty-string reward_id', async () => await expect400(await POST(req(url, 'POST', { reward_id: '' }))))
  it('rejects wrong-type reward_id', async () => await expect400(await POST(req(url, 'POST', { reward_id: 12345 }))))
})

// ===========================================================================
// /api/redemptions POST  (customer)
// ===========================================================================
describe('POST /api/redemptions validation', () => {
  const url = 'http://t/api/redemptions'
  let POST: typeof import('@/app/api/redemptions/route').POST
  beforeEach(async () => {
    as.customer()
    POST = (await import('@/app/api/redemptions/route')).POST
  })

  it('rejects empty body', async () => await expect400(await POST(req(url, 'POST', {}))))
  it('rejects non-uuid reward_id', async () => await expect400(await POST(req(url, 'POST', { reward_id: 'not-uuid' }))))
  it('rejects SQL injection reward_id', async () => await expect400(await POST(req(url, 'POST', { reward_id: SQLi }))))
  it('rejects script injection reward_id', async () => await expect400(await POST(req(url, 'POST', { reward_id: XSS }))))
  it('rejects empty-string reward_id', async () => await expect400(await POST(req(url, 'POST', { reward_id: '' }))))
})

// ===========================================================================
// /api/redemptions/[id] PATCH  (customer or admin)
// ===========================================================================
describe('PATCH /api/redemptions/[id] validation', () => {
  const url = 'http://t/api/redemptions/x'
  let PATCH: typeof import('@/app/api/redemptions/[id]/route').PATCH
  beforeEach(async () => {
    as.customer()
    PATCH = (await import('@/app/api/redemptions/[id]/route')).PATCH
  })

  it('rejects non-uuid id', async () => await expect400(await PATCH(req(url, 'PATCH', { action: 'cancel' }), params('not-uuid'))))
  it('rejects SQL injection id', async () => await expect400(await PATCH(req(url, 'PATCH', { action: 'cancel' }), params(SQLi))))
  it('rejects missing action', async () => await expect400(await PATCH(req(url, 'PATCH', {}), params(VALID_UUID))))
  it('rejects unknown action', async () => await expect400(await PATCH(req(url, 'PATCH', { action: 'delete' }), params(VALID_UUID))))
  it('rejects wrong-type action', async () => await expect400(await PATCH(req(url, 'PATCH', { action: 42 }), params(VALID_UUID))))
  it('rejects empty-string action', async () => await expect400(await PATCH(req(url, 'PATCH', { action: '' }), params(VALID_UUID))))
  it('rejects script injection action', async () => await expect400(await PATCH(req(url, 'PATCH', { action: XSS }), params(VALID_UUID))))
  it('rejects overflow-length notes', async () => await expect400(await PATCH(req(url, 'PATCH', { action: 'cancel', notes: HUGE_STR }), params(VALID_UUID))))
})

// ===========================================================================
// /api/rewards POST  (superadmin)
// ===========================================================================
describe('POST /api/rewards validation', () => {
  const url = 'http://t/api/rewards'
  const valid = { name: 'T-shirt', points_cost: 100 }
  let POST: typeof import('@/app/api/rewards/route').POST
  beforeEach(async () => {
    as.super()
    POST = (await import('@/app/api/rewards/route')).POST
  })

  it('rejects empty body', async () => await expect400(await POST(req(url, 'POST', {}))))
  it('rejects missing name', async () => await expect400(await POST(req(url, 'POST', { points_cost: 100 }))))
  it('rejects empty name', async () => await expect400(await POST(req(url, 'POST', { ...valid, name: '' }))))
  it('rejects wrong-type name', async () => await expect400(await POST(req(url, 'POST', { ...valid, name: 42 }))))
  it('rejects overflow-length name', async () => await expect400(await POST(req(url, 'POST', { ...valid, name: HUGE_STR }))))
  it('rejects missing points_cost', async () => await expect400(await POST(req(url, 'POST', { name: 'x' }))))
  it('rejects wrong-type points_cost', async () => await expect400(await POST(req(url, 'POST', { ...valid, points_cost: 'lots' }))))
  it('rejects negative points_cost', async () => await expect400(await POST(req(url, 'POST', { ...valid, points_cost: -10 }))))
  it('rejects zero points_cost', async () => await expect400(await POST(req(url, 'POST', { ...valid, points_cost: 0 }))))
  it('rejects overflow points_cost', async () => await expect400(await POST(req(url, 'POST', { ...valid, points_cost: OVERFLOW }))))
  it('rejects non-integer points_cost', async () => await expect400(await POST(req(url, 'POST', { ...valid, points_cost: 1.5 }))))
  it('rejects negative stock', async () => await expect400(await POST(req(url, 'POST', { ...valid, stock: -1 }))))
  it('rejects wrong-type stock', async () => await expect400(await POST(req(url, 'POST', { ...valid, stock: 'unlimited' }))))
  it('rejects overflow-length description', async () => await expect400(await POST(req(url, 'POST', { ...valid, description: HUGE_STR }))))
})

// ===========================================================================
// /api/rewards/[id] PUT  (superadmin)
// ===========================================================================
describe('PUT /api/rewards/[id] validation', () => {
  const url = 'http://t/api/rewards/x'
  let PUT: typeof import('@/app/api/rewards/[id]/route').PUT
  beforeEach(async () => {
    as.super()
    PUT = (await import('@/app/api/rewards/[id]/route')).PUT
  })

  it('rejects non-uuid id', async () => await expect400(await PUT(req(url, 'PUT', { name: 'x' }), params('not-uuid'))))
  it('rejects empty body', async () => await expect400(await PUT(req(url, 'PUT', {}), params(VALID_UUID))))
  it('rejects negative points_cost', async () => await expect400(await PUT(req(url, 'PUT', { points_cost: -5 }), params(VALID_UUID))))
  it('rejects overflow points_cost', async () => await expect400(await PUT(req(url, 'PUT', { points_cost: OVERFLOW }), params(VALID_UUID))))
  it('rejects negative stock', async () => await expect400(await PUT(req(url, 'PUT', { stock: -1 }), params(VALID_UUID))))
  it('rejects string-typed is_active', async () => await expect400(await PUT(req(url, 'PUT', { is_active: 'true' }), params(VALID_UUID))))
  it('rejects empty name', async () => await expect400(await PUT(req(url, 'PUT', { name: '' }), params(VALID_UUID))))
  it('rejects unknown key', async () => await expect400(await PUT(req(url, 'PUT', { evil_field: 'bad' }), params(VALID_UUID))))
})

// ===========================================================================
// /api/admin/staff POST  (superadmin)
// ===========================================================================
describe('POST /api/admin/staff validation', () => {
  const url = 'http://t/api/admin/staff'
  const valid = { username: 'staff1', password: 'pass1234' }
  let POST: typeof import('@/app/api/admin/staff/route').POST
  beforeEach(async () => {
    as.super()
    POST = (await import('@/app/api/admin/staff/route')).POST
  })

  it('rejects empty body', async () => await expect400(await POST(req(url, 'POST', {}))))
  it('rejects missing username', async () => await expect400(await POST(req(url, 'POST', { password: 'pass1234' }))))
  it('rejects missing password', async () => await expect400(await POST(req(url, 'POST', { username: 'staff1' }))))
  it('rejects short username', async () => await expect400(await POST(req(url, 'POST', { ...valid, username: 'ab' }))))
  it('rejects empty username', async () => await expect400(await POST(req(url, 'POST', { ...valid, username: '' }))))
  it('rejects SQL injection username', async () => await expect400(await POST(req(url, 'POST', { ...valid, username: SQLi }))))
  it('rejects script injection username', async () => await expect400(await POST(req(url, 'POST', { ...valid, username: XSS }))))
  it('rejects invalid chars in username', async () => await expect400(await POST(req(url, 'POST', { ...valid, username: 'bad name!' }))))
  it('rejects short password', async () => await expect400(await POST(req(url, 'POST', { ...valid, password: 'short' }))))
  it('rejects empty password', async () => await expect400(await POST(req(url, 'POST', { ...valid, password: '' }))))
  it('rejects overflow-length password', async () => await expect400(await POST(req(url, 'POST', { ...valid, password: HUGE_STR }))))
  it('rejects wrong-type password', async () => await expect400(await POST(req(url, 'POST', { ...valid, password: 12345678 }))))
})

// ===========================================================================
// /api/admin/staff/[id] PUT  (superadmin)
// ===========================================================================
describe('PUT /api/admin/staff/[id] validation', () => {
  const url = 'http://t/api/admin/staff/x'
  let PUT: typeof import('@/app/api/admin/staff/[id]/route').PUT
  beforeEach(async () => {
    as.super()
    PUT = (await import('@/app/api/admin/staff/[id]/route')).PUT
  })

  it('rejects non-uuid id', async () => await expect400(await PUT(req(url, 'PUT', { password: 'pass1234' }), params('not-uuid'))))
  it('rejects SQL injection id', async () => await expect400(await PUT(req(url, 'PUT', { password: 'pass1234' }), params(SQLi))))
  it('rejects empty body', async () => await expect400(await PUT(req(url, 'PUT', {}), params(VALID_UUID))))
  it('rejects missing password', async () => await expect400(await PUT(req(url, 'PUT', { foo: 'bar' }), params(VALID_UUID))))
  it('rejects short password', async () => await expect400(await PUT(req(url, 'PUT', { password: 'abc' }), params(VALID_UUID))))
  it('rejects empty password', async () => await expect400(await PUT(req(url, 'PUT', { password: '' }), params(VALID_UUID))))
  it('rejects wrong-type password', async () => await expect400(await PUT(req(url, 'PUT', { password: 12345678 }), params(VALID_UUID))))
  it('rejects overflow-length password', async () => await expect400(await PUT(req(url, 'PUT', { password: HUGE_STR }), params(VALID_UUID))))
  it('rejects unknown key', async () => await expect400(await PUT(req(url, 'PUT', { password: 'pass1234', extra: 'x' }), params(VALID_UUID))))
})

// ===========================================================================
// /api/customers/[id] GET/DELETE  &  /api/admin/staff/[id] GET/DELETE  &
// /api/rewards/[id] DELETE — id-only routes
// ===========================================================================
describe('id-only routes reject malformed id', () => {
  it('GET /api/customers/[id] non-uuid', async () => {
    as.admin()
    const { GET } = await import('@/app/api/customers/[id]/route')
    await expect400(await GET(req('http://t/x', 'GET'), params('not-uuid')))
  })
  it('DELETE /api/customers/[id] non-uuid', async () => {
    as.admin()
    const { DELETE } = await import('@/app/api/customers/[id]/route')
    await expect400(await DELETE(req('http://t/x', 'DELETE'), params('not-uuid')))
  })
  it('GET /api/admin/staff/[id] non-uuid', async () => {
    as.super()
    const { GET } = await import('@/app/api/admin/staff/[id]/route')
    await expect400(await GET(req('http://t/x', 'GET'), params('not-uuid')))
  })
  it('DELETE /api/admin/staff/[id] non-uuid', async () => {
    as.super()
    const { DELETE } = await import('@/app/api/admin/staff/[id]/route')
    await expect400(await DELETE(req('http://t/x', 'DELETE'), params('not-uuid')))
  })
  it('DELETE /api/rewards/[id] non-uuid', async () => {
    as.super()
    const { DELETE } = await import('@/app/api/rewards/[id]/route')
    await expect400(await DELETE(req('http://t/x', 'DELETE'), params('not-uuid')))
  })
  it('DELETE /api/rewards/[id] SQL injection id', async () => {
    as.super()
    const { DELETE } = await import('@/app/api/rewards/[id]/route')
    await expect400(await DELETE(req('http://t/x', 'DELETE'), params(SQLi)))
  })
})
