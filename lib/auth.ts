import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getAppRole } from '@/lib/apps.server'
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
 * Futsal admin: may act in the futsal business.
 *
 * profiles.role alone is not enough. A game-only or billiards-only staff
 * account also has profiles.role = 'admin', and without this check it could
 * call futsal APIs directly even though the (admin) layout keeps it off the
 * futsal screens.
 *
 * Rule (client decision): a global superadmin (profiles.role = 'superadmin')
 * passes everywhere; an admin must also hold a futsal grant in app_access.
 * getAppRole() returns null on a failed lookup, which denies.
 *
 * isFutsalAdmin() is the boolean form, for routes that serve both customers
 * and admins and branch on which one is calling.
 */
export async function isFutsalAdmin(profile: Profile | null): Promise<boolean> {
  if (!profile) return false
  if (profile.role === 'superadmin') return true
  if (profile.role !== 'admin') return false
  return (await getAppRole('futsal')) !== null
}

export async function requireFutsalAdmin(): Promise<Profile> {
  const profile = await getCurrentUser()
  if (!profile) throw new Error('UNAUTHENTICATED')
  if (!(await isFutsalAdmin(profile))) throw new Error('FORBIDDEN')
  return profile
}

/**
 * Global superadmin: profiles.role = 'superadmin'.
 *
 * Every superadmin owns all three businesses (the developer and the owners).
 * There is no per-business superadmin, so a 'superadmin' row in app_access
 * does not count here - see retire-per-app-superadmin-migration.sql.
 */
export const isSuperAdmin = cache(async (): Promise<boolean> => {
  const profile = await getCurrentUser()
  return profile?.role === 'superadmin'
})

/**
 * Kept as an alias so existing callers read naturally in futsal screens.
 * Same meaning as isSuperAdmin(): the global owner role.
 */
export const isFutsalSuperAdmin = isSuperAdmin

export async function requireSuperAdmin(): Promise<Profile> {
  const profile = await getCurrentUser()
  if (!profile) throw new Error('UNAUTHENTICATED')
  if (profile.role !== 'superadmin') throw new Error('FORBIDDEN')
  return profile
}
