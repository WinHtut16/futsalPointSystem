import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAnyAdmin } from '@/lib/auth'
import { APP_NAMES, type AppName } from '@/lib/apps'

/**
 * Grant and revoke per-business access.
 *
 * Uses the SIGNED-IN user's client, not the service role, on purpose. The
 * database decides who may hand out access: grant_app_access() checks
 * can_manage_app(), which admits a global superadmin or the superadmin of
 * that one business. Going through the service role here would bypass that
 * and move the decision into this file, where it would have to be
 * re-implemented and could drift from the rule the database enforces.
 *
 * requireAnyAdmin() below is only a cheap early exit for people with no admin
 * role at all; it is not the authorisation. That happens in Postgres.
 */

function isAppName(v: unknown): v is AppName {
  return typeof v === 'string' && (APP_NAMES as readonly string[]).includes(v)
}

/** Postgres errors, turned into something a person can act on. */
function explain(code: string | undefined, message: string): { status: number; error: string } {
  switch (code) {
    case '42501':
      return { status: 403, error: message }
    case '23503':
      return { status: 404, error: 'That account no longer exists.' }
    case '22023':
      return { status: 400, error: message }
    default:
      return { status: 500, error: `Could not update access${code ? ` (${code})` : ''}. ${message}` }
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAnyAdmin()
    const body = await request.json().catch(() => null)
    const userId = body?.userId
    const app = body?.app
    const role = body?.role

    if (typeof userId !== 'string' || !isAppName(app)) {
      return NextResponse.json({ error: 'Missing or unknown business.' }, { status: 400 })
    }
    if (role !== 'admin' && role !== 'superadmin') {
      return NextResponse.json({ error: 'Role must be admin or superadmin.' }, { status: 400 })
    }

    const supabase = await createClient()
    const { error } = await supabase.rpc('grant_app_access', {
      p_user_id: userId,
      p_app: app,
      p_role: role,
    })

    if (error) {
      // Read the error rather than discarding it: a denial and a broken call
      // look identical otherwise, which has cost this project hours before.
      console.error('[access] grant failed', {
        userId, app, role,
        code: error.code, message: error.message, details: error.details, hint: error.hint,
      })
      const { status, error: msg } = explain(error.code, error.message)
      return NextResponse.json({ error: msg }, { status })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAnyAdmin()
    const body = await request.json().catch(() => null)
    const userId = body?.userId
    const app = body?.app

    if (typeof userId !== 'string' || !isAppName(app)) {
      return NextResponse.json({ error: 'Missing or unknown business.' }, { status: 400 })
    }

    const supabase = await createClient()
    const { error } = await supabase.rpc('revoke_app_access', {
      p_user_id: userId,
      p_app: app,
    })

    if (error) {
      console.error('[access] revoke failed', {
        userId, app,
        code: error.code, message: error.message, details: error.details, hint: error.hint,
      })
      const { status, error: msg } = explain(error.code, error.message)
      return NextResponse.json({ error: msg }, { status })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }
}
