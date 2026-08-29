import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// ── Environment variables ────────────────────────────────────────────────────
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'

// ── Mock @supabase/ssr ───────────────────────────────────────────────────────
const mockGetUser = vi.fn()
const mockProfileSingle = vi.fn()
const mockRpc = vi.fn()

const profileChain = {
  select: vi.fn(),
  eq: vi.fn(),
  single: mockProfileSingle,
}
profileChain.select.mockReturnValue(profileChain)
profileChain.eq.mockReturnValue(profileChain)

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
    from: vi.fn(() => profileChain),
    rpc: mockRpc,
  })),
}))

// ── Import middleware AFTER mocks are set up ─────────────────────────────────
import { middleware } from '@/middleware'

// ── Helpers ───────────────────────────────────────────────────────────────────
function req(path: string): NextRequest {
  return new NextRequest(new URL(path, 'http://localhost:3000'))
}

function customerUser(id = 'u1') {
  return { id, email: '09123456789@akoatp.com' }
}

function adminUser(id = 'u1') {
  return { id, email: 'staffadmin@akoatp-staff.com' }
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe('middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Restore chain method return values after clearAllMocks
    profileChain.select.mockReturnValue(profileChain)
    profileChain.eq.mockReturnValue(profileChain)
    // Default: no session, no profile
    mockGetUser.mockResolvedValue({ data: { user: null } })
    mockProfileSingle.mockResolvedValue({ data: null, error: null })
    // Default: no per-business rank. Individual tests override.
    mockRpc.mockResolvedValue({ data: null, error: null })
  })

  // ── Unauthenticated guards ─────────────────────────────────────────────────

  it('unauthenticated GET /dashboard redirects to /login', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await middleware(req('/dashboard'))
    expect(res.headers.get('location')).toBe('http://localhost:3000/login')
    expect(mockProfileSingle).not.toHaveBeenCalled()
  })

  it('unauthenticated GET /admin/dashboard redirects to /admin/login carrying ?next=', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await middleware(req('/admin/dashboard'))
    expect(res.headers.get('location')).toBe('http://localhost:3000/admin/login?next=%2Fadmin%2Fdashboard')
    expect(mockProfileSingle).not.toHaveBeenCalled()
  })

  it('unauthenticated GET /book is allowed through (public booking page)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await middleware(req('/book'))
    expect(res.headers.get('location')).toBeNull()
    expect(mockProfileSingle).not.toHaveBeenCalled()
  })

  it('/admin/reset-password is accessible without a session (no redirect)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await middleware(req('/admin/reset-password'))
    expect(res.headers.get('location')).toBeNull()
  })

  // ── Auth-page redirects for logged-in users ────────────────────────────────

  it('logged-in customer on /login redirects to /account', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'customer' }, error: null })
    const res = await middleware(req('/login'))
    expect(res.headers.get('location')).toBe('http://localhost:3000/account')
  })

  it('logged-in admin on /login redirects to /admin', async () => {
    mockGetUser.mockResolvedValue({ data: { user: adminUser() } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'admin' }, error: null })
    const res = await middleware(req('/login'))
    expect(res.headers.get('location')).toBe('http://localhost:3000/admin')
  })

  it('logged-in admin on /admin/login redirects to /admin', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'admin' }, error: null })
    const res = await middleware(req('/admin/login'))
    expect(res.headers.get('location')).toBe('http://localhost:3000/admin')
  })

  // ── Admin-on-customer-route redirects (new behaviour) ─────────────────────

  it('admin on /account redirects to /admin', async () => {
    mockGetUser.mockResolvedValue({ data: { user: adminUser() } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'admin' }, error: null })
    const res = await middleware(req('/account'))
    expect(res.headers.get('location')).toBe('http://localhost:3000/admin')
  })

  it('superadmin on /account redirects to /admin', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'winhtutcentury@gmail.com' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'superadmin' }, error: null })
    const res = await middleware(req('/account'))
    expect(res.headers.get('location')).toBe('http://localhost:3000/admin')
  })

  it('admin on /book redirects to /admin', async () => {
    mockGetUser.mockResolvedValue({ data: { user: adminUser() } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'admin' }, error: null })
    const res = await middleware(req('/book'))
    expect(res.headers.get('location')).toBe('http://localhost:3000/admin')
  })

  it('admin on /bookings redirects to /admin', async () => {
    mockGetUser.mockResolvedValue({ data: { user: adminUser() } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'admin' }, error: null })
    const res = await middleware(req('/bookings'))
    expect(res.headers.get('location')).toBe('http://localhost:3000/admin')
  })

  it('admin on /rewards redirects to /admin', async () => {
    mockGetUser.mockResolvedValue({ data: { user: adminUser() } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'admin' }, error: null })
    const res = await middleware(req('/rewards'))
    expect(res.headers.get('location')).toBe('http://localhost:3000/admin')
  })

  it('admin on /dashboard redirects to /admin', async () => {
    mockGetUser.mockResolvedValue({ data: { user: adminUser() } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'admin' }, error: null })
    const res = await middleware(req('/dashboard'))
    expect(res.headers.get('location')).toBe('http://localhost:3000/admin')
  })

  // ── Customers on customer routes — NO extra DB query ──────────────────────

  it('customer on /account is allowed through without a DB query', async () => {
    mockGetUser.mockResolvedValue({ data: { user: customerUser() } })
    const res = await middleware(req('/account'))
    expect(res.headers.get('location')).toBeNull()
    expect(mockProfileSingle).not.toHaveBeenCalled()
  })

  it('customer on /book is allowed through without a DB query', async () => {
    mockGetUser.mockResolvedValue({ data: { user: customerUser() } })
    const res = await middleware(req('/book'))
    expect(res.headers.get('location')).toBeNull()
    expect(mockProfileSingle).not.toHaveBeenCalled()
  })

  // ── Admin route protection ─────────────────────────────────────────────────

  it('customer session on /admin/dashboard redirects to /account', async () => {
    mockGetUser.mockResolvedValue({ data: { user: customerUser() } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'customer' }, error: null })
    const res = await middleware(req('/admin/dashboard'))
    expect(res.headers.get('location')).toBe('http://localhost:3000/account')
  })

  it('plain admin session on /admin/staff redirects to /admin/dashboard', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'admin' }, error: null })
    const res = await middleware(req('/admin/staff'))
    expect(res.headers.get('location')).toBe('http://localhost:3000/admin/dashboard')
  })

  it('superadmin session on /admin/staff is allowed through (no redirect)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'superadmin' }, error: null })
    const res = await middleware(req('/admin/staff'))
    expect(res.headers.get('location')).toBeNull()
  })

  it('user with no profile row on /admin/dashboard is redirected to /account', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockProfileSingle.mockResolvedValue({ data: null, error: null })
    const res = await middleware(req('/admin/dashboard'))
    expect(res.headers.get('location')).toBe('http://localhost:3000/account')
  })

  // ── Portal routing ─────────────────────────────────────────────────────────

  it('unauthenticated deep link into a zone keeps its full path in ?next=', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await middleware(req('/admin/billiards/session/42'))
    expect(res.headers.get('location')).toBe(
      'http://localhost:3000/admin/login?next=%2Fadmin%2Fbilliards%2Fsession%2F42'
    )
  })

  it('unauthenticated deep link preserves the query string too', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await middleware(req('/admin/bookings?status=pending'))
    expect(res.headers.get('location')).toBe(
      'http://localhost:3000/admin/login?next=%2Fadmin%2Fbookings%3Fstatus%3Dpending'
    )
  })

  it('admin session on /admin passes through to the router page', async () => {
    mockGetUser.mockResolvedValue({ data: { user: adminUser() } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'admin' }, error: null })
    const res = await middleware(req('/admin'))
    expect(res.headers.get('location')).toBeNull()
  })

  it('customer session on /admin is sent to /account, not the chooser', async () => {
    mockGetUser.mockResolvedValue({ data: { user: customerUser() } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'customer' }, error: null })
    const res = await middleware(req('/admin'))
    expect(res.headers.get('location')).toBe('http://localhost:3000/account')
  })

  it('admin session on /admin/apps passes through (no futsal grant needed)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: adminUser() } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'admin' }, error: null })
    const res = await middleware(req('/admin/apps'))
    expect(res.headers.get('location')).toBeNull()
  })

  // ── Per-business superadmin rank ───────────────────────────────────────────

  it('global superadmin reaches /admin/staff without an app_role lookup', async () => {
    mockGetUser.mockResolvedValue({ data: { user: adminUser() } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'superadmin' }, error: null })
    const res = await middleware(req('/admin/staff'))
    expect(res.headers.get('location')).toBeNull()
    // the common case must stay free: no extra round trip
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('admin who is superadmin of futsal only reaches /admin/staff', async () => {
    mockGetUser.mockResolvedValue({ data: { user: adminUser() } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'admin' }, error: null })
    mockRpc.mockResolvedValue({ data: 'superadmin', error: null })
    const res = await middleware(req('/admin/staff'))
    expect(res.headers.get('location')).toBeNull()
    expect(mockRpc).toHaveBeenCalledWith('app_role', { p_app: 'futsal' })
  })

  it('plain admin with no futsal rank is turned away from /admin/export', async () => {
    mockGetUser.mockResolvedValue({ data: { user: adminUser() } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'admin' }, error: null })
    mockRpc.mockResolvedValue({ data: 'admin', error: null })
    const res = await middleware(req('/admin/export'))
    expect(res.headers.get('location')).toBe('http://localhost:3000/admin/dashboard')
  })

  it('a failing app_role lookup denies rather than admits', async () => {
    mockGetUser.mockResolvedValue({ data: { user: adminUser() } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'admin' }, error: null })
    mockRpc.mockRejectedValue(new Error('connection reset'))
    const res = await middleware(req('/admin/staff'))
    expect(res.headers.get('location')).toBe('http://localhost:3000/admin/dashboard')
  })
})
