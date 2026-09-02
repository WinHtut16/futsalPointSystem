/**
 * GET /api/admin/audit/export
 *
 * The property that matters here is which client reads the rows. The audit_log
 * select policy (can_manage_app) is what stops a billiards-only superadmin
 * seeing futsal and game entries. The service role bypasses RLS, so reading
 * the export with it would put every business into the file of anyone allowed
 * to click the button - with no error, no warning, and a spreadsheet that
 * looks entirely normal. Hence a test rather than a comment.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

const apps: { value: { app: string; role: string }[] | null } = { value: null }

vi.mock('@/lib/auth', () => ({
  requireAnyAdmin: vi.fn(async () => {
    if (apps.value === null) throw new Error('FORBIDDEN')
    return { id: 'admin-3', role: 'admin' }
  }),
}))

vi.mock('@/lib/apps.server', () => ({
  getMyApps: vi.fn(async () => apps.value),
}))

const signedInCalls: { method: string; args: unknown[] }[] = []
const serviceCalls: { method: string; args: unknown[] }[] = []
let signedInUsed = false
let serviceReadUsed = false

function readChain(sink: { method: string; args: unknown[] }[]) {
  const c: Record<string, unknown> = {}
  for (const m of ['select', 'gte', 'order', 'range', 'eq']) {
    c[m] = (...args: unknown[]) => {
      sink.push({ method: m, args })
      return c
    }
  }
  c.then = (resolve: (v: unknown) => void) => resolve({ data: [], error: null })
  return c
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: (t: string) => {
      signedInUsed = true
      signedInCalls.push({ method: 'from', args: [t] })
      return readChain(signedInCalls)
    },
  })),
  createServiceClient: vi.fn(async () => ({
    from: () => {
      serviceReadUsed = true
      return readChain(serviceCalls)
    },
    rpc: (name: string, args: unknown) => {
      serviceCalls.push({ method: 'rpc', args: [name, args] })
      return Promise.resolve({ error: null })
    },
  })),
}))

const { GET } = await import('@/app/api/admin/audit/export/route')

beforeEach(() => {
  signedInCalls.length = 0
  serviceCalls.length = 0
  signedInUsed = false
  serviceReadUsed = false
  apps.value = [{ app: 'billiards', role: 'superadmin' }]
})

function get(qs = '') {
  return new Request(`http://localhost/api/admin/audit/export${qs}`)
}

describe('audit export — who may, and how it reads', () => {
  it('reads the rows with the signed-in client so RLS applies', async () => {
    const res = await GET(get())
    expect(res.status).toBe(200)
    expect(signedInUsed).toBe(true)
    // The service role may only be used for the "this was exported" row.
    expect(serviceReadUsed).toBe(false)
    expect(signedInCalls.some((c) => c.method === 'from' && c.args[0] === 'audit_log')).toBe(true)
  })

  it('refuses an admin who is superadmin of nothing', async () => {
    apps.value = [{ app: 'futsal', role: 'admin' }]
    const res = await GET(get())
    expect(res.status).toBe(403)
    expect(signedInUsed).toBe(false)
  })

  it('refuses when the grant list cannot be read, rather than exporting everything', async () => {
    apps.value = []
    const res = await GET(get())
    expect(res.status).toBe(403)
  })

  it('returns a spreadsheet, not JSON', async () => {
    const res = await GET(get())
    expect(res.headers.get('Content-Type')).toContain('spreadsheetml')
    expect(res.headers.get('Content-Disposition')).toContain('.xlsx')
  })

  it('passes the business filter through', async () => {
    const res = await GET(get('?app=billiards'))
    expect(res.status).toBe(200)
    expect(signedInCalls).toContainEqual({ method: 'eq', args: ['app', 'billiards'] })
  })

  it('ignores an unknown business rather than filtering on it', async () => {
    await GET(get('?app=casino'))
    expect(signedInCalls.some((c) => c.method === 'eq' && c.args[0] === 'app')).toBe(false)
  })

  it('records the export, with the real actor, after building the file', async () => {
    await GET(get('?app=billiards'))
    const rpc = serviceCalls.find((c) => c.method === 'rpc')
    expect(rpc).toBeDefined()
    const [name, args] = rpc!.args as [string, Record<string, unknown>]
    expect(name).toBe('audit')
    expect(args.p_action).toBe('export.generated')
    expect(args.p_app).toBe('billiards')
    // The service role has no auth.uid(), so without this every export would
    // be recorded as done by "system".
    expect(args.p_actor).toBe('admin-3')
  })
})
