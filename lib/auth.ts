import { createClient } from '@/lib/supabase/server'
import type { Profile, UserRole } from '@/types'

export async function getCurrentUser(): Promise<Profile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return data
}

export async function requireRole(role: UserRole | UserRole[]): Promise<Profile> {
  const profile = await getCurrentUser()
  const roles = Array.isArray(role) ? role : [role]
  if (!profile || !roles.includes(profile.role)) {
    throw new Error('Unauthorized')
  }
  return profile
}

export async function requireAnyAdmin(): Promise<Profile> {
  return requireRole(['admin', 'superadmin'])
}

export async function requireSuperAdmin(): Promise<Profile> {
  return requireRole('superadmin')
}
