/**
 * POST /api/admin/staff — creating an admin creates their access too.
 *
 * These tests exist because of a specific failure: three systems each had their
 * own admin-creation path, and two of them produced accounts that could not sign
 * in anywhere. Nothing threw. The account looked made, the superadmin handed over
 * a password, and the person hit "Invalid credentials" or an empty portal.
 *
 * So the properties worth pinning are the ones that were silently violated:
 *   - an account is never created without at least one business
 *   - the username stored is the one the sign-in identity is built from
 *   - a failed provision leaves NO orphan auth user holding that username
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const authState: { role: 'customer' | 'admin' | 'superadmin' | null } = { role: null }

vi.mock('@/lib/auth', () => ({
  requireSuperAdmin: vi.fn(async () => {
    if (authState.role !== 'superadmin') throw new Error('FORBIDDEN')
    return { id: 'super-1', role: 'superadmin' }
  }),
}))

// --- Supabase doubles ------------------------------------------------------
const createUser = vi.fn()
const deleteUser = vi.fn()
const rpc = vi.fn()
/** Result of the "is this username taken?" lookup. */
const existingProfile: { data: unknown } = { data: null }

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: existingProfile.data, error: null }),
        }),
      }),
    }),
    auth: { admin: { createUser, deleteUser } },
  })),
  createClient: vi.fn(async () => ({ rpc })),
}))

const { POST } = await import('@/app/api/admin/staff/route')

function post(body: unknown) {
  return new NextRequest('http://localhost/api/admin/staff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const OK_USER = { data: { user: { id: 'new-user-1' } }, error: null }

beforeEach(() => {
  authState.role = 'superadmin'
  existingProfile.data = null
  createUser.mockReset().mockResolvedValue(OK_USER)
  deleteUser.mockReset().mockResolvedValue({ error: null })
  rpc.mockReset().mockResolvedValue({ error: null })
})

describe('POST /api/admin/staff — access is part of creation', () => {
  it('refuses an account with no business, and creates no auth user', async () => {
    const res = await POST(post({ username: 'kyaw', password: 'passw0rd!', grants: [] }))
    expect(res.status).toBe(400)
    // The important half: it did not get as far as making an account.
    expect(createUser).not.toHaveBeenCalled()
  })

  it('refuses a missing grants field rather than defaulting to none', async () => {
    const res = await POST(post({ username: 'kyaw', password: 'passw0rd!' }))
    expect(res.status).toBe(400)
    expect(createUser).not.toHaveBeenCalled()
  })

  it('refuses the same business twice', async () => {
    const res = await POST(
      post({
        username: 'kyaw',
        password: 'passw0rd!',
        grants: [
          { app: 'game', role: 'admin' },
          { app: 'game', role: 'superadmin' },
        ],
      })
    )
    expect(res.status).toBe(400)
    expect(createUser).not.toHaveBeenCalled()
  })

  it('provisions the profile and every grant in one call', async () => {
    const res = await POST(
      post({
        username: 'kyaw',
        password: 'passw0rd!',
        grants: [
          { app: 'billiards', role: 'admin' },
          { app: 'game', role: 'superadmin' },
        ],
      })
    )
    expect(res.status).toBe(201)
    expect(rpc).toHaveBeenCalledWith('provision_admin', {
      p_user_id: 'new-user-1',
      p_username: 'kyaw',
      p_grants: [
        { app: 'billiards', role: 'admin' },
        { app: 'game', role: 'superadmin' },
      ],
    })
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('stores the lowercased username, matching the sign-in identity', async () => {
    // usernameToAdminEmail() lowercases when it builds {username}@akoatp-staff.com.
    // If the profile kept "Kyaw", the staff list would show a name that is not
    // what the person must type, and the "already taken?" lookup would miss a
    // real collision.
    const res = await POST(
      post({ username: 'Kyaw.Soe', password: 'passw0rd!', grants: [{ app: 'futsal', role: 'admin' }] })
    )
    expect(res.status).toBe(201)
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'kyaw.soe@akoatp-staff.com' })
    )
    expect(rpc).toHaveBeenCalledWith(
      'provision_admin',
      expect.objectContaining({ p_username: 'kyaw.soe' })
    )
  })

  it('deletes the auth user when provisioning fails, so the username is not stranded', async () => {
    rpc.mockResolvedValue({ error: { code: '42501', message: 'Not authorised to manage access for futsal.' } })
    const res = await POST(
      post({ username: 'kyaw', password: 'passw0rd!', grants: [{ app: 'futsal', role: 'admin' }] })
    )
    expect(res.status).toBe(403)
    // auth.users.email is unique and nothing in the UI can see or clear an
    // orphan, so leaving one would lock that username away for good.
    expect(deleteUser).toHaveBeenCalledWith('new-user-1')
  })

  it('rejects a taken username before touching auth', async () => {
    existingProfile.data = { id: 'someone-else' }
    const res = await POST(
      post({ username: 'kyaw', password: 'passw0rd!', grants: [{ app: 'game', role: 'admin' }] })
    )
    expect(res.status).toBe(409)
    expect(createUser).not.toHaveBeenCalled()
  })

  it('refuses a non-superadmin', async () => {
    authState.role = 'admin'
    const res = await POST(
      post({ username: 'kyaw', password: 'passw0rd!', grants: [{ app: 'game', role: 'admin' }] })
    )
    expect(res.status).toBe(403)
    expect(createUser).not.toHaveBeenCalled()
  })
})
