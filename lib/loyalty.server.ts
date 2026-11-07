import 'server-only'

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getAppRole } from '@/lib/apps.server'
import type { AppRole } from '@/lib/apps'
import type { Profile } from '@/types'
import type { LoyaltyApp } from '@/lib/loyalty'

/**
 * The caller must hold a grant for THIS business, at least at `rank`.
 *
 * app_role() already folds in the global superadmin, so the owner passes
 * everywhere and a billiards manager passes billiards only. A failed lookup
 * returns null from getAppRole and is treated as a denial - never the other
 * way round.
 */
export async function requireLoyaltyRole(app: LoyaltyApp, rank: AppRole): Promise<Profile> {
  const profile = await getCurrentUser()
  if (!profile) throw new Error('UNAUTHENTICATED')
  if (profile.role !== 'admin' && profile.role !== 'superadmin') throw new Error('FORBIDDEN')

  const role = await getAppRole(app)
  if (role === null) throw new Error('FORBIDDEN')
  if (rank === 'superadmin' && role !== 'superadmin') throw new Error('FORBIDDEN')
  return profile
}

/** The thrown guard errors as responses, same codes as the futsal routes. */
export function guardResponse(error: unknown): NextResponse {
  if (error instanceof Error && error.message === 'FORBIDDEN') {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }
  return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
}
