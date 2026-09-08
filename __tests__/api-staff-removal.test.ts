/**
 * Removing a staff member.
 *
 * This exists because of a specific dead end. Deleting an admin who had done
 * any work was correctly refused by the database - their sessions and point
 * entries are foreign keys with no cascade - but the route tried to recognise
 * that refusal by pattern-matching the error text for
 * 'foreign key|violates|constraint'. GoTrue returns none of those words, only
 * "Database error deleting user", so every blocked delete fell through to the
 * generic handler and reached the superadmin as "An unexpected error
 * occurred". The only supported way to remove someone looked broken.
 *
 * So the properties pinned here are: ask the database instead of guessing at a
 * vendor's wording, never attempt a delete that is known to be blocked, and
 * always offer the removal that does work.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  requireSuperAdmin: vi.fn(async () => ({ id: 'super-1', role: 'superadmin' })),
  requireAnyAdmin: vi.fn(async () => ({ id: 'super-1', role: 'superadmin' })),
  getCurrentUser: vi.fn(async () => ({ id: 'super-1', role: 'superadmin' })),
  isFutsalSuperAdmin: vi.fn(async () => true),
}))

const deleteUser = vi.fn()
const signedInRpc = vi.fn()
const serviceRpc = vi.fn()
const targetRole: { value: string | null } = { value: 'admin' }

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: targetRole.value ? { role: targetRole.value } : null,
            error: null,
          }),
        }),
      }),
    }),
    auth: { admin: { deleteUser } },
    rpc: serviceRpc,
  })),
  createClient: vi.fn(async () => ({ rpc: signedInRpc })),
}))

const { DELETE } = await import('@/app/api/admin/staff/[id]/route')
const { POST: removeAccess } = await import('@/app/api/admin/staff/[id]/remove-access/route')

const ID = '7ccb97fe-2870-4efd-b83a-7f5c3fd32531'
const params = Promise.resolve({ id: ID })
const req = () => new NextRequest(`http://localhost/api/admin/staff/${ID}`)

beforeEach(() => {
  targetRole.value = 'admin'
  deleteUser.mockReset().mockResolvedValue({ error: null })
  signedInRpc.mockReset().mockResolvedValue({ data: {}, error: null })
  serviceRpc.mockReset().mockResolvedValue({ data: null, error: null })
})

describe('DELETE /api/admin/staff/[id] — when history is in the way', () => {
  it('refuses with a specific reason and does not attempt the delete', async () => {
    signedInRpc.mockResolvedValue({
      data: { billiards_sessions: 12, futsal_point_entries: 3 },
      error: null,
    })

    const res = await DELETE(req(), { params })
    expect(res.status).toBe(409)

    const body = await res.json()
    expect(body.canRemoveAccessInstead).toBe(true)
    expect(body.blocking).toEqual({ billiards_sessions: 12, futsal_point_entries: 3 })

    // The whole point: a delete that is known to be blocked is never sent, so
    // the superadmin never sees the opaque vendor error at all.
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('deletes when the database reports nothing in the way', async () => {
    signedInRpc.mockResolvedValue({ data: {}, error: null })
    const res = await DELETE(req(), { params })
    expect(res.status).toBe(200)
    expect(deleteUser).toHaveBeenCalledWith(ID)
  })

  it('never answers a blocked delete with the generic message', async () => {
    // The exact string Supabase returns. It contains none of the words the old
    // regex looked for, which is how this became "An unexpected error occurred".
    signedInRpc.mockResolvedValue({ data: {}, error: null })
    deleteUser.mockResolvedValue({ error: { message: 'Database error deleting user' } })

    const res = await DELETE(req(), { params })
    expect(res.status).toBe(409)

    const body = await res.json()
    expect(body.error).toContain('Database error deleting user')
    expect(body.error).not.toMatch(/unexpected error/i)
    expect(body.canRemoveAccessInstead).toBe(true)
  })

  it('still refuses to touch a non-admin through this route', async () => {
    targetRole.value = 'superadmin'
    const res = await DELETE(req(), { params })
    expect(res.status).toBe(404)
    expect(deleteUser).not.toHaveBeenCalled()
  })
})

describe('POST /api/admin/staff/[id]/remove-access', () => {
  it('goes through the signed-in client, not the service role', async () => {
    // remove_admin_access loops revoke_app_access, which checks
    // can_manage_app() per business and writes an audit row naming the actor.
    // The service role has no auth.uid(), so it would skip the per-business
    // check and log every removal as done by nobody.
    const res = await removeAccess(req(), { params })
    expect(res.status).toBe(200)
    expect(signedInRpc).toHaveBeenCalledWith('remove_admin_access', { p_user_id: ID })
    expect(serviceRpc).not.toHaveBeenCalled()
  })

  it('passes a Postgres refusal back as 403, not a server error', async () => {
    signedInRpc.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'You cannot remove your own access.' },
    })
    const res = await removeAccess(req(), { params })
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('You cannot remove your own access.')
  })
})
