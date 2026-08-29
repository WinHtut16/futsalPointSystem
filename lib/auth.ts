import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getAppRole } from '@/lib/apps'
import type { Profile, UserRole } from '@/types'

export const getCurrentUser = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return data
})

export async function requireRole(role: UserRole | UserRole[]): Promise<Profile> {
  const profile = await getCurrentUser()
  const roles = Array.isArray(role) ? role : [role]
  if (!profile) throw new Error('UNAUTHENTICATED')
  if (!roles.includes(profile.role)) throw new Error('FORBIDDEN')
  return profile
}

export async function requireAnyAdmin(): Promise<Profile> {
  return requireRole(['admin', 'superadmin'])
}

/**
 * Superadmin *of futsal*, not superadmin globally.
 *
 * Behaviourally identical today: app_role('futsal') returns 'superadmin' for
 * anyone holding the global profiles.role = 'superadmin'. What it adds is the
 * ability to hold rank in one business without holding it in all of them -
 * a billiards manager should not inherit the power to purge futsal bookings.
 *
 * Every superadmin-gated futsal screen and API route goes through this or
 * isFutsalSuperAdmin() below, so there is one place to change if that rule
 * ever moves.
 */
export const isFutsalSuperAdmin = cache(async (): Promise<boolean> => {
  return (await getAppRole('futsal')) === 'superadmin'
})

export async function requireSuperAdmin(): Promise<Profile> {
  const profile = await getCurrentUser()
  if (!profile) throw new Error('UNAUTHENTICATED')
  if (!(await isFutsalSuperAdmin())) throw new Error('FORBIDDEN')
  return profile
}
