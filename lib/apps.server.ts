import 'server-only'

import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { isAppName, isAppRole, type AppGrant, type AppName, type AppRole } from './apps'

/**
 * Server-side access lookups.
 *
 * Split out of ./apps so that constants and types can be imported from client
 * components without dragging next/headers into the browser bundle. The
 * `server-only` import above turns any such mistake into a clear build error
 * naming this file, rather than a bundler trace pointing at whichever
 * component happened to import a constant.
 */

/**
 * Every business the signed-in admin may enter, with their rank in each.
 *
 * One round trip. The precedence rule — a global superadmin outranks any
 * per-app row — lives in Postgres (my_apps/app_role) rather than here, so the
 * RLS policies and the application can never drift apart on who counts as what.
 */
export const getMyApps = cache(async (): Promise<AppGrant[] | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('my_apps')
  // null means "could not determine", which is NOT the same as "no access".
  // Callers must not revoke on null, or a momentary DB blip locks out every
  // admin on a live system.
  if (error) return null
  if (!data) return []
  return (data as { app: string; role: string }[])
    .filter((row) => isAppName(row.app) && isAppRole(row.role))
    .map((row) => ({ app: row.app as AppName, role: row.role as AppRole }))
})

/**
 * Rank in one business, or null when the caller cannot enter it at all.
 * Note the failure mode is deliberate: a transient DB error returns null, i.e.
 * denies. Never invert this to "allow on error".
 */
export const getAppRole = cache(async (app: AppName): Promise<AppRole | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('app_role', { p_app: app })
  if (error || !isAppRole(data)) return null
  return data
})

export async function hasAppAccess(app: AppName): Promise<boolean> {
  return (await getAppRole(app)) !== null
}
