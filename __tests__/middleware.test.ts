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

// ── Helper ───────────────────────────────────────────────────────────────────
function req(path: string): NextRequest {
  return new NextRequest(new URL(path, 'http://localhost:3000'))
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

  it('customer session on /admin/dashboard redirects to /dashboard', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'customer' }, error: null })
    const res = await middleware(req('/admin/dashboard'))
    expect(res.headers.get('location')).toBe('http://localhost:3000/dashboard')
  })

  it('plain admin session on /admin/staff redirects to /admin/dashboard', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'admin' }, error: null })
    const res = await middleware(req('/admin/staff'))
    expect(res.headers.get('location')).toBe('http://localhost:3000/admin/dashboard')
  })

  it('/admin/reset-password is accessible without a session (no redirect)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await middleware(req('/admin/reset-password'))
    expect(res.headers.get('location')).toBeNull()
  })

  it('logged-in customer on /login redirects to /dashboard', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'customer' }, error: null })
    const res = await middleware(req('/login'))
    expect(res.headers.get('location')).toBe('http://localhost:3000/dashboard')
  })

  it('logged-in admin on /admin/login redirects to /admin/dashboard', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'admin' }, error: null })
    const res = await middleware(req('/admin/login'))
    expect(res.headers.get('location')).toBe('http://localhost:3000/admin/dashboard')
  })

  it('superadmin session on /admin/staff is allowed through (no redirect)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'superadmin' }, error: null })
    const res = await middleware(req('/admin/staff'))
    expect(res.headers.get('location')).toBeNull()
  })

  it('user with no profile row on /admin/dashboard is redirected to /dashboard', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockProfileSingle.mockResolvedValue({ data: null, error: null })
    const res = await middleware(req('/admin/dashboard'))
    expect(res.headers.get('location')).toBe('http://localhost:3000/dashboard')
  })
})
