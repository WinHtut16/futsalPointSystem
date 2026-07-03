import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// ── Environment variables ────────────────────────────────────────────────────
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'

// ── Mock @supabase/ssr ───────────────────────────────────────────────────────
const mockGetUser = vi.fn()
const mockProfileSingle = vi.fn()

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
  })

  // ── Unauthenticated guards ─────────────────────────────────────────────────

  it('unauthenticated GET /dashboard redirects to /login', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await middleware(req('/dashboard'))
    expect(res.headers.get('location')).toBe('http://localhost:3000/login')
    expect(mockProfileSingle).not.toHaveBeenCalled()
  })

  it('unauthenticated GET /admin/dashboard redirects to /admin/login', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await middleware(req('/admin/dashboard'))
    expect(res.headers.get('location')).toBe('http://localhost:3000/admin/login')
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

  it('logged-in admin on /login redirects to /admin/dashboard', async () => {
    mockGetUser.mockResolvedValue({ data: { user: adminUser() } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'admin' }, error: null })
    const res = await middleware(req('/login'))
    expect(res.headers.get('location')).toBe('http://localhost:3000/admin/dashboard')
  })

  it('logged-in admin on /admin/login redirects to /admin/dashboard', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'admin' }, error: null })
    const res = await middleware(req('/admin/login'))
    expect(res.headers.get('location')).toBe('http://localhost:3000/admin/dashboard')
  })

  // ── Admin-on-customer-route redirects (new behaviour) ─────────────────────

  it('admin on /account redirects to /admin/dashboard', async () => {
    mockGetUser.mockResolvedValue({ data: { user: adminUser() } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'admin' }, error: null })
    const res = await middleware(req('/account'))
    expect(res.headers.get('location')).toBe('http://localhost:3000/admin/dashboard')
  })

  it('superadmin on /account redirects to /admin/dashboard', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'winhtutcentury@gmail.com' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'superadmin' }, error: null })
    const res = await middleware(req('/account'))
    expect(res.headers.get('location')).toBe('http://localhost:3000/admin/dashboard')
  })

  it('admin on /book redirects to /admin/dashboard', async () => {
    mockGetUser.mockResolvedValue({ data: { user: adminUser() } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'admin' }, error: null })
    const res = await middleware(req('/book'))
    expect(res.headers.get('location')).toBe('http://localhost:3000/admin/dashboard')
  })

  it('admin on /bookings redirects to /admin/dashboard', async () => {
    mockGetUser.mockResolvedValue({ data: { user: adminUser() } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'admin' }, error: null })
    const res = await middleware(req('/bookings'))
    expect(res.headers.get('location')).toBe('http://localhost:3000/admin/dashboard')
  })

  it('admin on /rewards redirects to /admin/dashboard', async () => {
    mockGetUser.mockResolvedValue({ data: { user: adminUser() } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'admin' }, error: null })
    const res = await middleware(req('/rewards'))
    expect(res.headers.get('location')).toBe('http://localhost:3000/admin/dashboard')
  })

  it('admin on /dashboard redirects to /admin/dashboard', async () => {
    mockGetUser.mockResolvedValue({ data: { user: adminUser() } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'admin' }, error: null })
    const res = await middleware(req('/dashboard'))
    expect(res.headers.get('location')).toBe('http://localhost:3000/admin/dashboard')
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
})
