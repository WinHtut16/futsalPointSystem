import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth'
import { IdParamSchema, badRequest, serverError } from '@/lib/schemas'

/**
 * Remove a staff member without destroying what they recorded.
 *
 * This is the supported removal, and for anyone who has worked a shift it is
 * the ONLY one - their sessions, point entries and bookings are foreign keys
 * with no cascade, so deleting the account is refused by the database. That
 * refusal is correct; the history is worth more than a tidy list.
 *
 * Signed-in client, not the service role: remove_admin_access loops
 * revoke_app_access, which checks can_manage_app() per business and writes an
 * audit row for each. Going through the service role would bypass exactly the
 * per-business authorisation the client asked for, and lose the actor on every
 * audit entry.
 */
export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin()

    const idParsed = IdParamSchema.safeParse(await params)
    if (!idParsed.success) return badRequest(idParsed.error)
    const { id } = idParsed.data

    const supabase = await createClient()
    const { data, error } = await supabase.rpc('remove_admin_access', { p_user_id: id })

    if (error) {
      console.error('[staff] remove access failed', {
        id, code: error.code, message: error.message, details: error.details,
      })
      if (error.code === '42501') {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
      return serverError(error.message)
    }

    return NextResponse.json({ success: true, revoked: data ?? 0 })
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }
}
