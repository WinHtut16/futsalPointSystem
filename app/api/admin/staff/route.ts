import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth'
import { usernameToAdminEmail } from '@/lib/utils'
import { StaffCreateSchema, badRequest, parseJson, serverError } from '@/lib/schemas'

export async function GET() {
  try {
    await requireSuperAdmin()
    const supabase = await createServiceClient()
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, role, created_at')
      .eq('role', 'admin')
      .order('created_at', { ascending: false })
    if (error) return serverError(error.message)
    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin()

    const parsed = StaffCreateSchema.safeParse(await parseJson(request))
    if (!parsed.success) return badRequest(parsed.error)
    const { username, password, grants } = parsed.data

    const supabase = await createServiceClient()

    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ error: 'Username already taken.' }, { status: 409 })
    }

    const email = usernameToAdminEmail(username)

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username },
    })
    if (authError) return serverError(authError.message)

    // The profile row AND every business grant, in one Postgres transaction.
    //
    // Called with the SIGNED-IN client, not the service role, and that is not an
    // oversight: provision_admin -> can_manage_app reads auth.uid(), which the
    // service role leaves NULL, so a service-role call would be refused. It also
    // means Postgres re-decides who may hand out which business rather than this
    // file re-implementing that rule and drifting from it.
    const asCaller = await createClient()
    const { error: provisionError } = await asCaller.rpc('provision_admin', {
      p_user_id: authData.user.id,
      p_username: username,
      p_grants: grants,
    })

    if (provisionError) {
      // Roll the auth user back. It is seconds old and has no history - the
      // alternative is an orphan that owns the username forever, because
      // auth.users.email is unique and nothing in the UI can see or clear it.
      // Nothing partial survives: provision_admin is one transaction, so on
      // error no profile was promoted and no grant was written.
      await supabase.auth.admin.deleteUser(authData.user.id)
      console.error('[staff] provision failed', {
        username,
        code: provisionError.code,
        message: provisionError.message,
        details: provisionError.details,
      })
      if (provisionError.code === '42501') {
        return NextResponse.json({ error: provisionError.message }, { status: 403 })
      }
      if (provisionError.code === '22023') {
        return NextResponse.json({ error: provisionError.message }, { status: 400 })
      }
      return serverError(provisionError.message)
    }

    return NextResponse.json(
      { id: authData.user.id, username, role: 'admin', grants },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }
}
