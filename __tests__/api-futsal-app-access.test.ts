import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Futsal admin APIs must check the futsal grant, not just profiles.role.
 *
 * A game-only or billiards-only staff account also has profiles.role = 'admin'.
 * Before requireFutsalAdmin() it could call these routes directly. Unlike the
 * other API suites, this one runs the REAL lib/auth so it proves the routes are
 * wired to the grant check; only Supabase is faked.
 */

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return { ...actual, cache: <T,>(fn: T) => fn }
})

const state: {
  role: string | null
  futsalGrant: 'admin' | 'superadmin' | null
  /** What any service-client .single() returns. */
  row: Record<string, unknown> | null
} = {
  role: null,
  futsalGrant: null,
  row: null,
}

const USER_ID = '00000000-0000-4000-8000-000000000001'

const profileChain = {
  select: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(async () =>
    state.role
      ? { data: { id: USER_ID, username: 'staff', role: state.role, total_points: 0 }, error: null }
      : { data: null, error: null }
  ),
}
profileChain.select.mockReturnValue(profileChain)
profileChain.eq.mockReturnValue(profileChain)

const rpc = vi.fn(async (fn: string, args: { p_app: string }) => {
  if (fn !== 'app_role') return { data: null, error: { message: 'unexpected rpc' } }
  if (state.role === 'superadmin') return { data: 'superadmin', error: null }
  return { data: args.p_app === 'futsal' ? state.futsalGrant : null, error: null }
})

// Any query on the service client resolves to "nothing found".
const serviceCalls = vi.fn()
function emptyQuery(): unknown {
  const result = { data: [], error: null }
  return new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'then') return (res: (v: unknown) => void) => res(result)
        if (prop === 'single' || prop === 'maybeSingle')
          return async () => ({ data: state.row, error: null })
        return () => emptyQuery()
      },
    }
  )
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: state.role ? { id: USER_ID } : null } })),
    },
    from: vi.fn(() => profileChain),
    rpc,
  })),
  createServiceClient: vi.fn(() => {
    serviceCalls()
    // Not thenable itself: routes `await createServiceClient()`.
    return { from: () => emptyQuery(), rpc: async () => ({ data: null, error: null }) }
  }),
  broadcastSlotChange: vi.fn(async () => {}),
}))

import { POST as addPoints } from '@/app/api/points/add/route'
import { GET as listCustomers } from '@/app/api/customers/route'
import { GET as slotAvailability } from '@/app/api/admin/slot-availability/route'
import { PATCH as patchBooking } from '@/app/api/bookings/[id]/route'

const CUSTOMER_ID = '00000000-0000-4000-8000-0000000000c1'
const BOOKING_ID = '00000000-0000-4000-8000-0000000000b1'

function req(url: string, init?: { method?: string; body?: unknown }) {
  return new NextRequest(`http://localhost${url}`, {
    method: init?.method ?? 'GET',
    headers: { 'content-type': 'application/json' },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  })
}

const calls = {
  addPoints: () =>
    addPoints(req('/api/points/add', { method: 'POST', body: { customer_id: CUSTOMER_ID, hours_played: 1 } })),
  customers: () => listCustomers(req('/api/customers')),
  slots: () => slotAvailability(req('/api/admin/slot-availability?date=2026-11-10')),
  confirmBooking: () =>
    patchBooking(req(`/api/bookings/${BOOKING_ID}`, { method: 'PATCH', body: { action: 'confirm' } }), {
      params: Promise.resolve({ id: BOOKING_ID }),
    }),
}

beforeEach(() => {
  vi.clearAllMocks()
  state.row = null
  profileChain.select.mockReturnValue(profileChain)
  profileChain.eq.mockReturnValue(profileChain)
})

describe('game-only / billiards-only admin is refused by futsal APIs', () => {
  beforeEach(() => {
    state.role = 'admin'
    state.futsalGrant = null
  })

  it('POST /api/points/add → 403, no DB access', async () => {
    const res = await calls.addPoints()
    expect(res.status).toBe(403)
    expect(serviceCalls).not.toHaveBeenCalled()
  })

  it('GET /api/customers → 403, no DB access', async () => {
    const res = await calls.customers()
    expect(res.status).toBe(403)
    expect(serviceCalls).not.toHaveBeenCalled()
  })

  it('GET /api/admin/slot-availability → 403, no DB access', async () => {
    const res = await calls.slots()
    expect(res.status).toBe(403)
    expect(serviceCalls).not.toHaveBeenCalled()
  })

  it('PATCH /api/bookings/[id] confirm → 403', async () => {
    state.row = {
      id: BOOKING_ID,
      customer_id: CUSTOMER_ID,
      status: 'pending',
      deposit_received: false,
      override_request: false,
      booking_date: '2026-11-10',
    }
    const res = await calls.confirmBooking()
    expect(res.status).toBe(403)
  })
})

describe('futsal admin and global superadmin still pass', () => {
  it.each([
    ['admin with a futsal grant', 'admin', 'admin'],
    ['global superadmin with no app_access row', 'superadmin', null],
  ] as const)('%s', async (_label, role, grant) => {
    state.role = role
    state.futsalGrant = grant

    // Past the guard: the customer lookup finds nothing → 404, not 403.
    expect((await calls.addPoints()).status).toBe(404)
    expect((await calls.customers()).status).toBe(200)
    expect((await calls.slots()).status).toBe(200)
    expect(serviceCalls).toHaveBeenCalled()
  })
})
