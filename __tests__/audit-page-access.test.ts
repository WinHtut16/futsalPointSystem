/**
 * /admin/audit — who is allowed to look, and how it reads.
 *
 * The page is a superadmin surface across all three businesses, so the two
 * properties worth pinning are the ones that would be quiet if broken:
 *
 *   - a plain admin is turned away (a leak here would show one business's
 *     staff what another business's superadmin did)
 *   - it reads with the SIGNED-IN client, never the service role, because the
 *     audit_log select policy is what scopes a per-business superadmin to
 *     their own rows. Service role bypasses RLS and would hand everyone
 *     everything, silently and with no error to notice.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

const apps: { value: { app: string; role: string }[] | null } = { value: null }
const redirected: string[] = []

vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    redirected.push(to)
    throw new Error('NEXT_REDIRECT')
  },
}))

vi.mock('@/lib/auth', () => ({
  requireAnyAdmin: vi.fn(async () => ({ id: 'me', role: 'admin' })),
}))

vi.mock('@/lib/apps.server', () => ({
  getMyApps: vi.fn(async () => apps.value),
}))

const serviceClient = vi.fn()
const calls: { method: string; args: unknown[] }[] = []
const result: { data: unknown; error: unknown } = { data: [], error: null }

function chain() {
  const c: Record<string, unknown> = {}
  for (const m of ['select', 'gte', 'order', 'range', 'eq']) {
    c[m] = (...args: unknown[]) => {
      calls.push({ method: m, args })
      return c
    }
  }
  c.then = (resolve: (v: unknown) => void) => resolve({ data: result.data, error: result.error })
  return c
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: (table: string) => {
      calls.push({ method: 'from', args: [table] })
      return chain()
    },
  })),
  createServiceClient: serviceClient,
}))

const { default: AuditPage } = await import('@/app/(admin)/admin/audit/page')

beforeEach(() => {
  redirected.length = 0
  calls.length = 0
  serviceClient.mockReset()
  result.data = []
  result.error = null
})

const noParams = Promise.resolve({})

describe('/admin/audit — access', () => {
  it('turns away an admin who is superadmin of nothing', async () => {
    apps.value = [
      { app: 'futsal', role: 'admin' },
      { app: 'game', role: 'admin' },
    ]
    await expect(AuditPage({ searchParams: noParams })).rejects.toThrow('NEXT_REDIRECT')
    expect(redirected).toEqual(['/admin/dashboard'])
  })

  it('lets in a superadmin of one business, even without futsal', async () => {
    apps.value = [{ app: 'billiards', role: 'superadmin' }]
    await AuditPage({ searchParams: noParams })
    expect(redirected).toEqual([])
    expect(calls.some((c) => c.method === 'from' && c.args[0] === 'audit_log')).toBe(true)
  })

  it('turns away someone with no grants at all rather than showing an empty log', async () => {
    apps.value = []
    await expect(AuditPage({ searchParams: noParams })).rejects.toThrow('NEXT_REDIRECT')
  })

  it('treats an unreadable grant list as no access, not as full access', async () => {
    // getMyApps returns null for "could not determine". Failing open here
    // would hand the whole log to anyone during a DB blip.
    apps.value = null
    await expect(AuditPage({ searchParams: noParams })).rejects.toThrow('NEXT_REDIRECT')
  })

  it('never reaches for the service role', async () => {
    apps.value = [{ app: 'futsal', role: 'superadmin' }]
    await AuditPage({ searchParams: noParams })
    expect(serviceClient).not.toHaveBeenCalled()
  })
})

describe('/admin/audit — filters', () => {
  beforeEach(() => {
    apps.value = [
      { app: 'futsal', role: 'superadmin' },
      { app: 'billiards', role: 'superadmin' },
    ]
  })

  it('applies a business filter when one is given', async () => {
    await AuditPage({ searchParams: Promise.resolve({ app: 'billiards' }) })
    expect(calls).toContainEqual({ method: 'eq', args: ['app', 'billiards'] })
  })

  it('ignores an unknown business rather than passing it through', async () => {
    await AuditPage({ searchParams: Promise.resolve({ app: 'casino' }) })
    expect(calls.some((c) => c.method === 'eq' && c.args[0] === 'app')).toBe(false)
  })

  it('applies an actor filter', async () => {
    await AuditPage({ searchParams: Promise.resolve({ actor: 'user-9' }) })
    expect(calls).toContainEqual({ method: 'eq', args: ['actor_id', 'user-9'] })
  })

  it('asks for one row more than a page, to know if there is a next page', async () => {
    await AuditPage({ searchParams: Promise.resolve({}) })
    expect(calls).toContainEqual({ method: 'range', args: [0, 50] })
  })

  it('pages from the right offset', async () => {
    await AuditPage({ searchParams: Promise.resolve({ page: '3' }) })
    expect(calls).toContainEqual({ method: 'range', args: [100, 150] })
  })

  it('falls back to 30 days when the range is junk', async () => {
    await AuditPage({ searchParams: Promise.resolve({ days: '9999' }) })
    const gte = calls.find((c) => c.method === 'gte')
    expect(gte).toBeDefined()
    const since = new Date(String((gte!.args as [string, string])[1])).getTime()
    const expected = Date.now() - 30 * 24 * 60 * 60 * 1000
    expect(Math.abs(since - expected)).toBeLessThan(5000)
  })
})
