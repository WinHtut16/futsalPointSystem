/**
 * Privilege-escalation suite. Verifies every protected /api route rejects
 * (401 or 403) when called by an under-privileged or unauthenticated caller.
 *
 * Mocks `@/lib/auth` to flip the caller's identity per test. Mocks
 * `@/lib/supabase/server` as a no-op safety net — the guard exception fires
 * before any DB call, so handlers should never reach Supabase here. If a
 * handler ever does reach the mocked client, the throw inside the no-op also
 * surfaces as a 401 via the route's catch block, which is still a passing
 * assertion for these tests.
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
    if (!state.user) throw new Error('UNAUTHENTICATED')
    if (!roles.includes(state.user.role)) throw new Error('FORBIDDEN')
    return state.user
  }),
  requireAnyAdmin: vi.fn(async () => {
    if (!state.user) throw new Error('UNAUTHENTICATED')
    if (!['admin', 'superadmin'].includes(state.user.role)) throw new Error('FORBIDDEN')
    return state.user
  }),
  requireSuperAdmin: vi.fn(async () => {
    if (!state.user) throw new Error('UNAUTHENTICATED')
    if (state.user.role !== 'superadmin') throw new Error('FORBIDDEN')
    return state.user
  }),
}))

vi.mock('@/lib/supabase/server', () => {
  const fail = () => {
    throw new Error('supabase should not be reached in privilege-escalation tests')
  }
  return {
    createClient: vi.fn(fail),
    createServiceClient: vi.fn(fail),
  }
})

beforeEach(() => {
  state.user = null
  vi.mocked(createServiceClient).mockClear()
  vi.mocked(createClient).mockClear()
})

// Regression-proof: if a route forgets its guard, it would reach the (mocked)
// supabase client. Even though the mock throws and the route's catch returns
// 401, the test would falsely pass. Asserting the client was never invoked
// catches a removed guard.
afterEach(() => {
  expect(vi.mocked(createServiceClient)).not.toHaveBeenCalled()
  expect(vi.mocked(createClient)).not.toHaveBeenCalled()
})

function asCustomer() {
  state.user = { id: 'cust-1', role: 'customer', total_points: 0 }
}
function asAdmin() {
  state.user = { id: 'adm-1', role: 'admin', total_points: 0 }
}
function unauth() {
  state.user = null
}

function jsonReq(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

const ok = (status: number) => expect([401, 403]).toContain(status)

// ---------------------------------------------------------------------------
// (1) Customer → POST /api/points/add  (admin-only)
// ---------------------------------------------------------------------------
describe('customer cannot add points', () => {
  it('POST /api/points/add returns 401/403', async () => {
    asCustomer()
    const { POST } = await import('@/app/api/points/add/route')
    const res = await POST(jsonReq('http://t/api/points/add', 'POST', {
      customer_id: 'cust-2',
      hours_played: 5,
    }))
    ok(res.status)
  })
})

// ---------------------------------------------------------------------------
// (2) Customer → /api/rewards mutations  (superadmin-only)
// ---------------------------------------------------------------------------
describe('customer cannot mutate rewards', () => {
  it('POST /api/rewards returns 401/403', async () => {
    asCustomer()
    const { POST } = await import('@/app/api/rewards/route')
    const res = await POST(jsonReq('http://t/api/rewards', 'POST', {
      name: 'x',
      points_cost: 10,
    }))
    ok(res.status)
  })

  it('PUT /api/rewards/[id] returns 401/403', async () => {
    asCustomer()
    const { PUT } = await import('@/app/api/rewards/[id]/route')
    const res = await PUT(
      jsonReq('http://t/api/rewards/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'PUT', { name: 'evil' }),
      params('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    )
    ok(res.status)
  })

  it('DELETE /api/rewards/[id] returns 401/403', async () => {
    asCustomer()
    const { DELETE } = await import('@/app/api/rewards/[id]/route')
    const res = await DELETE(jsonReq('http://t/api/rewards/r1', 'DELETE'), params('r1'))
    ok(res.status)
  })
})

// Bonus: admin (not super) also blocked from rewards mutation — same guard
describe('plain admin cannot mutate rewards', () => {
  it('POST /api/rewards returns 401/403', async () => {
    asAdmin()
    const { POST } = await import('@/app/api/rewards/route')
    const res = await POST(jsonReq('http://t/api/rewards', 'POST', {
      name: 'x',
      points_cost: 10,
    }))
    ok(res.status)
  })

  it('DELETE /api/rewards/[id] returns 401/403', async () => {
    asAdmin()
    const { DELETE } = await import('@/app/api/rewards/[id]/route')
    const res = await DELETE(jsonReq('http://t/api/rewards/r1', 'DELETE'), params('r1'))
    ok(res.status)
  })
})

// ---------------------------------------------------------------------------
// (3) Admin → /api/admin/staff*  (superadmin-only)
// ---------------------------------------------------------------------------
describe('plain admin cannot touch staff endpoints', () => {
  it('GET /api/admin/staff returns 401/403', async () => {
    asAdmin()
    const { GET } = await import('@/app/api/admin/staff/route')
    const res = await GET()
    ok(res.status)
  })

  it('POST /api/admin/staff returns 401/403', async () => {
    asAdmin()
    const { POST } = await import('@/app/api/admin/staff/route')
    const res = await POST(jsonReq('http://t/api/admin/staff', 'POST', {
      username: 'mole',
      password: 'password123',
    }))
    ok(res.status)
  })

  it('GET /api/admin/staff/[id] returns 401/403', async () => {
    asAdmin()
    const { GET } = await import('@/app/api/admin/staff/[id]/route')
    const res = await GET(jsonReq('http://t/api/admin/staff/s1', 'GET'), params('s1'))
    ok(res.status)
  })

  it('PUT /api/admin/staff/[id] returns 401/403', async () => {
    asAdmin()
    const { PUT } = await import('@/app/api/admin/staff/[id]/route')
    const res = await PUT(
      jsonReq('http://t/api/admin/staff/s1', 'PUT', { password: 'newpass12' }),
      params('s1')
    )
    ok(res.status)
  })

  it('DELETE /api/admin/staff/[id] returns 401/403', async () => {
    asAdmin()
    const { DELETE } = await import('@/app/api/admin/staff/[id]/route')
    const res = await DELETE(jsonReq('http://t/api/admin/staff/s1', 'DELETE'), params('s1'))
    ok(res.status)
  })
})

// ---------------------------------------------------------------------------
// (4) Unauthenticated → every protected /api/* route
// /api/auth/register intentionally public — excluded.
// ---------------------------------------------------------------------------
describe('unauthenticated callers are rejected from every protected route', () => {
  beforeEach(unauth)

  it('GET /api/customers', async () => {
    const { GET } = await import('@/app/api/customers/route')
    const res = await GET(jsonReq('http://t/api/customers', 'GET'))
    ok(res.status)
  })

  it('GET /api/customers/[id]', async () => {
    const { GET } = await import('@/app/api/customers/[id]/route')
    const res = await GET(jsonReq('http://t/api/customers/c1', 'GET'), params('c1'))
    ok(res.status)
  })

  it('PUT /api/customers/[id]', async () => {
    const { PUT } = await import('@/app/api/customers/[id]/route')
    const res = await PUT(
      jsonReq('http://t/api/customers/c1', 'PUT', { password: 'newpass12' }),
      params('c1')
    )
    ok(res.status)
  })

  it('DELETE /api/customers/[id]', async () => {
    const { DELETE } = await import('@/app/api/customers/[id]/route')
    const res = await DELETE(jsonReq('http://t/api/customers/c1', 'DELETE'), params('c1'))
    ok(res.status)
  })

  it('POST /api/points/add', async () => {
    const { POST } = await import('@/app/api/points/add/route')
    const res = await POST(jsonReq('http://t/api/points/add', 'POST', {
      customer_id: 'c1',
      hours_played: 1,
    }))
    ok(res.status)
  })

  it('GET /api/redemptions', async () => {
    const { GET } = await import('@/app/api/redemptions/route')
    const res = await GET()
    ok(res.status)
  })

  it('POST /api/redemptions', async () => {
    const { POST } = await import('@/app/api/redemptions/route')
    const res = await POST(jsonReq('http://t/api/redemptions', 'POST', { reward_id: 'r1' }))
    ok(res.status)
  })

  it('PATCH /api/redemptions/[id]', async () => {
    const { PATCH } = await import('@/app/api/redemptions/[id]/route')
    const res = await PATCH(
      jsonReq('http://t/api/redemptions/rr1', 'PATCH', { action: 'cancel' }),
      params('rr1')
    )
    ok(res.status)
  })

  it('GET /api/rewards', async () => {
    const { GET } = await import('@/app/api/rewards/route')
    const res = await GET()
    ok(res.status)
  })

  it('POST /api/rewards', async () => {
    const { POST } = await import('@/app/api/rewards/route')
    const res = await POST(jsonReq('http://t/api/rewards', 'POST', {
      name: 'x',
      points_cost: 10,
    }))
    ok(res.status)
  })

  it('PUT /api/rewards/[id]', async () => {
    const { PUT } = await import('@/app/api/rewards/[id]/route')
    const res = await PUT(
      jsonReq('http://t/api/rewards/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'PUT', { name: 'x' }),
      params('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    )
    ok(res.status)
  })

  it('DELETE /api/rewards/[id]', async () => {
    const { DELETE } = await import('@/app/api/rewards/[id]/route')
    const res = await DELETE(jsonReq('http://t/api/rewards/r1', 'DELETE'), params('r1'))
    ok(res.status)
  })

  it('GET /api/admin/staff', async () => {
    const { GET } = await import('@/app/api/admin/staff/route')
    const res = await GET()
    ok(res.status)
  })

  it('POST /api/admin/staff', async () => {
    const { POST } = await import('@/app/api/admin/staff/route')
    const res = await POST(jsonReq('http://t/api/admin/staff', 'POST', {
      username: 'x',
      password: 'password123',
    }))
    ok(res.status)
  })

  it('GET /api/admin/staff/[id]', async () => {
    const { GET } = await import('@/app/api/admin/staff/[id]/route')
    const res = await GET(jsonReq('http://t/api/admin/staff/s1', 'GET'), params('s1'))
    ok(res.status)
  })

  it('PUT /api/admin/staff/[id]', async () => {
    const { PUT } = await import('@/app/api/admin/staff/[id]/route')
    const res = await PUT(
      jsonReq('http://t/api/admin/staff/s1', 'PUT', { password: 'newpass12' }),
      params('s1')
    )
    ok(res.status)
  })

  it('DELETE /api/admin/staff/[id]', async () => {
    const { DELETE } = await import('@/app/api/admin/staff/[id]/route')
    const res = await DELETE(jsonReq('http://t/api/admin/staff/s1', 'DELETE'), params('s1'))
    ok(res.status)
  })
})
