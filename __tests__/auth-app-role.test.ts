import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * The API route tests mock '@/lib/auth' wholesale and substitute their own
 * requireSuperAdmin, so none of them exercise the real implementation. These
 * tests do, because that function decides who can purge bookings and export
 * every customer's data.
 */

// lib/auth and lib/apps wrap their readers in React's cache(), which only
// exists in the server build Next resolves. Vitest resolves the client build,
// where it is undefined - which is why the real lib/auth had never been under
// test at all. A passthrough is faithful: cache() only dedupes repeat calls
// within one request, and each test here makes one.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return { ...actual, cache: <T,>(fn: T) => fn }
})

const mockGetUser = vi.fn()
const mockRpc = vi.fn()
const profileChain = { select: vi.fn(), eq: vi.fn(), single: vi.fn() }
profileChain.select.mockReturnValue(profileChain)
profileChain.eq.mockReturnValue(profileChain)

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: vi.fn(() => profileChain),
    rpc: mockRpc,
  })),
  createServiceClient: vi.fn(),
}))

import { requireSuperAdmin, isFutsalSuperAdmin, requireFutsalAdmin, isFutsalAdmin } from '@/lib/auth'
import { getMyApps, getAppRole } from '@/lib/apps.server'
import { landingFor, APPS } from '@/lib/apps'

const USER = { id: 'u-1', email: 'someone@akoatp-staff.com' }

function signedInAs(role: string) {
  mockGetUser.mockResolvedValue({ data: { user: USER } })
  profileChain.single.mockResolvedValue({
    data: { id: USER.id, username: 'someone', role, total_points: 0 },
    error: null,
  })
}

// Rule (client decision): superadmin is GLOBAL only (profiles.role). A
// per-business 'superadmin' grant must not raise anyone's rank, and an admin
// acts only in businesses they hold a grant for.

function resetChain() {
  vi.clearAllMocks()
  profileChain.select.mockReturnValue(profileChain)
  profileChain.eq.mockReturnValue(profileChain)
}

describe('isFutsalSuperAdmin (global superadmin)', () => {
  beforeEach(resetChain)

  it('true for a global superadmin', async () => {
    signedInAs('superadmin')
    await expect(isFutsalSuperAdmin()).resolves.toBe(true)
  })

  it('false for an admin even if app_role reports superadmin (legacy per-app row)', async () => {
    signedInAs('admin')
    mockRpc.mockResolvedValue({ data: 'superadmin', error: null })
    await expect(isFutsalSuperAdmin()).resolves.toBe(false)
  })

  it('false for a plain admin', async () => {
    signedInAs('admin')
    await expect(isFutsalSuperAdmin()).resolves.toBe(false)
  })

  it('false with no session', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    await expect(isFutsalSuperAdmin()).resolves.toBe(false)
  })
})

describe('requireSuperAdmin', () => {
  beforeEach(resetChain)

  it('throws UNAUTHENTICATED with no session', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    await expect(requireSuperAdmin()).rejects.toThrow('UNAUTHENTICATED')
  })

  it('throws FORBIDDEN for a plain admin', async () => {
    signedInAs('admin')
    mockRpc.mockResolvedValue({ data: 'admin', error: null })
    await expect(requireSuperAdmin()).rejects.toThrow('FORBIDDEN')
  })

  it('throws FORBIDDEN for a per-business superadmin who is not global', async () => {
    signedInAs('admin')
    mockRpc.mockResolvedValue({ data: 'superadmin', error: null })
    await expect(requireSuperAdmin()).rejects.toThrow('FORBIDDEN')
  })

  it('admits a global superadmin', async () => {
    signedInAs('superadmin')
    await expect(requireSuperAdmin()).resolves.toMatchObject({ role: 'superadmin' })
  })
})

describe('requireFutsalAdmin', () => {
  beforeEach(resetChain)

  it('throws UNAUTHENTICATED with no session', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    await expect(requireFutsalAdmin()).rejects.toThrow('UNAUTHENTICATED')
  })

  it('admits a global superadmin without consulting app_access', async () => {
    signedInAs('superadmin')
    await expect(requireFutsalAdmin()).resolves.toMatchObject({ role: 'superadmin' })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('admits an admin holding a futsal grant', async () => {
    signedInAs('admin')
    mockRpc.mockResolvedValue({ data: 'admin', error: null })
    await expect(requireFutsalAdmin()).resolves.toMatchObject({ role: 'admin' })
    expect(mockRpc).toHaveBeenCalledWith('app_role', { p_app: 'futsal' })
  })

  it('FORBIDS a game-only / billiards-only admin (no futsal grant)', async () => {
    signedInAs('admin')
    mockRpc.mockResolvedValue({ data: null, error: null })
    await expect(requireFutsalAdmin()).rejects.toThrow('FORBIDDEN')
  })

  it('DENIES when the lookup errors - never admits on failure', async () => {
    signedInAs('admin')
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    await expect(requireFutsalAdmin()).rejects.toThrow('FORBIDDEN')
  })

  it('FORBIDS a customer', async () => {
    signedInAs('customer')
    mockRpc.mockResolvedValue({ data: 'admin', error: null })
    await expect(requireFutsalAdmin()).rejects.toThrow('FORBIDDEN')
  })
})

describe('isFutsalAdmin', () => {
  beforeEach(resetChain)

  it('false for null', async () => {
    await expect(isFutsalAdmin(null)).resolves.toBe(false)
  })

  it('false for an admin without a futsal grant', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })
    await expect(isFutsalAdmin({ role: 'admin' } as never)).resolves.toBe(false)
  })

  it('true for an admin with a futsal grant', async () => {
    mockRpc.mockResolvedValue({ data: 'admin', error: null })
    await expect(isFutsalAdmin({ role: 'admin' } as never)).resolves.toBe(true)
  })
})

describe('getMyApps', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    profileChain.select.mockReturnValue(profileChain)
    profileChain.eq.mockReturnValue(profileChain)
  })

  it('returns null on error - NOT an empty list', async () => {
    // Conflating the two would let one DB blip read as "access revoked" and
    // lock every admin out of a live system at once.
    mockRpc.mockResolvedValue({ data: null, error: { message: 'timeout' } })
    await expect(getMyApps()).resolves.toBeNull()
  })

  it('returns [] when the account genuinely has no grants', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null })
    await expect(getMyApps()).resolves.toEqual([])
  })

  it('drops rows whose app or role is not one we recognise', async () => {
    mockRpc.mockResolvedValue({
      data: [
        { app: 'futsal', role: 'admin' },
        { app: 'bowling', role: 'admin' },      // not a business we have
        { app: 'billiards', role: 'owner' },    // not a rank we have
      ],
      error: null,
    })
    await expect(getMyApps()).resolves.toEqual([{ app: 'futsal', role: 'admin' }])
  })
})

describe('landingFor', () => {
  it('sends a single-business admin straight in, with no chooser', () => {
    expect(landingFor([{ app: 'billiards', role: 'admin' }])).toBe(APPS.billiards.href)
  })

  it('shows the chooser for several businesses', () => {
    expect(
      landingFor([
        { app: 'futsal', role: 'admin' },
        { app: 'game', role: 'admin' },
      ])
    ).toBe('/admin/apps')
  })

  it('shows the chooser for none, so the empty state can explain why', () => {
    // Sending them to /account instead would bounce off middleware straight
    // back to /admin and loop.
    expect(landingFor([])).toBe('/admin/apps')
  })

  it('falls back to futsal when access could not be determined', () => {
    expect(landingFor(null)).toBe(APPS.futsal.href)
  })
})
