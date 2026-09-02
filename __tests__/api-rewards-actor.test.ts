/**
 * Reward writes must carry the actor.
 *
 * These routes go through the service role, where auth.uid() is NULL, so the
 * audit trigger on public.rewards reads the actor from rewards.updated_by
 * instead. If a route ever stops stamping that column, nothing breaks and no
 * error appears - every price change is just quietly attributed to "system"
 * from then on. That is precisely the kind of silent gap this whole feature
 * exists to prevent, so it gets a test rather than a convention.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const authState: { role: 'admin' | 'superadmin' | null } = { role: null }

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'admin-7', role: authState.role })),
  requireAnyAdmin: vi.fn(async () => {
    if (!authState.role) throw new Error('FORBIDDEN')
    return { id: 'admin-7', role: authState.role }
  }),
  requireSuperAdmin: vi.fn(async () => {
    if (authState.role !== 'superadmin') throw new Error('FORBIDDEN')
    return { id: 'admin-7', role: 'superadmin' }
  }),
  isFutsalSuperAdmin: vi.fn(async () => authState.role === 'superadmin'),
}))

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}))

const written: Record<string, unknown>[] = []

function chain() {
  const c: Record<string, unknown> = {}
  c.insert = (payload: Record<string, unknown>) => {
    written.push(payload)
    return c
  }
  c.update = (payload: Record<string, unknown>) => {
    written.push(payload)
    return c
  }
  c.select = () => c
  c.eq = () => c
  c.single = async () => ({ data: { id: 'r1' }, error: null })
  c.then = (resolve: (v: unknown) => void) => resolve({ data: null, error: null })
  return c
}

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(async () => ({ from: () => chain() })),
  createClient: vi.fn(async () => ({ from: () => chain() })),
}))

const { POST } = await import('@/app/api/rewards/route')
const { PUT, DELETE } = await import('@/app/api/rewards/[id]/route')

function req(body: unknown) {
  return new NextRequest('http://localhost/api/rewards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const params = Promise.resolve({ id: '3f8a1c62-1f4a-4a5e-9d2b-7c6e5a4b3d21' })

beforeEach(() => {
  written.length = 0
  authState.role = 'superadmin'
})

describe('reward writes stamp updated_by', () => {
  it('on create', async () => {
    const res = await POST(req({ name: 'Free drink', points_cost: 100 }))
    expect(res.status).toBe(201)
    expect(written).toHaveLength(1)
    expect(written[0].updated_by).toBe('admin-7')
  })

  it('on a full update', async () => {
    await PUT(req({ name: 'Free drink', points_cost: 150 }), { params })
    expect(written).toHaveLength(1)
    expect(written[0].updated_by).toBe('admin-7')
  })

  it('on the active toggle, which a plain admin may do', async () => {
    // The toggle path is the one an ordinary admin can reach, so it is the one
    // most likely to be left unstamped - and the one where knowing who hid a
    // reward actually matters.
    authState.role = 'admin'
    await PUT(req({ is_active: false }), { params })
    expect(written).toHaveLength(1)
    expect(written[0].updated_by).toBe('admin-7')
    expect(written[0].is_active).toBe(false)
  })

  it('on delete, which is a soft delete and so still an update', async () => {
    await DELETE(new NextRequest('http://localhost/api/rewards/x'), { params })
    expect(written).toHaveLength(1)
    expect(written[0].updated_by).toBe('admin-7')
    expect(written[0].is_deleted).toBe(true)
  })
})
