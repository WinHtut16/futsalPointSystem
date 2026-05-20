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

export async function requireRole(role: UserRole): Promise<Profile> {
  const profile = await getCurrentUser()
  if (!profile || profile.role !== role) {
    throw new Error('Unauthorized')
  }
  return profile
}
