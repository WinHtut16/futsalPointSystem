import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
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

export async function requireSuperAdmin(): Promise<Profile> {
  return requireRole('superadmin')
}
