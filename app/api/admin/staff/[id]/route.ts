import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth'
import { IdParamSchema, StaffPasswordUpdateSchema, badRequest, parseJson, serverError } from '@/lib/schemas'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin()

    const idParsed = IdParamSchema.safeParse(await params)
    if (!idParsed.success) return badRequest(idParsed.error)
    const { id } = idParsed.data

    const supabase = await createServiceClient()
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, role, created_at')
      .eq('id', id)
      .eq('role', 'admin')
      .single()
    if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const superadmin = await requireSuperAdmin()

    const idParsed = IdParamSchema.safeParse(await params)
    if (!idParsed.success) return badRequest(idParsed.error)
    const { id } = idParsed.data

    if (id === superadmin.id) {
      return NextResponse.json({ error: 'Cannot modify your own account here.' }, { status: 400 })
    }

    const parsed = StaffPasswordUpdateSchema.safeParse(await parseJson(request))
    if (!parsed.success) return badRequest(parsed.error)

    const supabase = await createServiceClient()

    // IDOR guard: only admin accounts may be managed through this endpoint
    const { data: target } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', id)
      .single()
    if (!target || target.role !== 'admin') {
      return NextResponse.json({ error: 'Admin not found.' }, { status: 404 })
    }

    const { error } = await supabase.auth.admin.updateUserById(id, { password: parsed.data.password })
    if (error) return serverError(error.message)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const superadmin = await requireSuperAdmin()

    const idParsed = IdParamSchema.safeParse(await params)
    if (!idParsed.success) return badRequest(idParsed.error)
    const { id } = idParsed.data

    if (id === superadmin.id) {
      return NextResponse.json({ error: 'Cannot delete your own account.' }, { status: 400 })
    }

    const supabase = await createServiceClient()
    const { data: target } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', id)
      .single()

    if (!target || target.role !== 'admin') {
      return NextResponse.json({ error: 'Admin not found.' }, { status: 404 })
    }

    // Delete the auth user and let Postgres cascade. profiles, app_access,
    // billiards.admins and game.staff all reference auth.users(id) ON DELETE
    // CASCADE, so this one call clears every row the account owns.
    //
    // Do NOT delete the profiles row first, as this used to. That made the
    // removal non-atomic in the worst direction: transactions.created_by and
    // bookings.created_by reference profiles(id) with no cascade, so for any
    // admin who had actually done work the profiles delete failed, or the auth
    // delete after it did - leaving exactly the half-deleted account this whole
    // change exists to make impossible. Deleting the auth user is one statement:
    // if any history blocks a cascade, the database aborts all of it and nothing
    // is touched.
    //
    // That refusal is the normal case for anyone who has worked a shift, and it
    // is not a failure to paper over - the history is worth more than the tidy
    // list. Removing their access is the right move there, and the message says so.
    // Ask the database what is in the way BEFORE trying, rather than trying and
    // then guessing from the error text. The previous version pattern-matched
    // the failure for 'foreign key|violates|constraint'; GoTrue returns none of
    // those words, only the opaque "Database error deleting user", so every
    // blocked delete fell through to the generic handler and reached the
    // superadmin as "An unexpected error occurred" - a dead end on the only
    // supported way to remove someone.
    const asCaller = await createClient()
    const { data: blocking, error: checkError } = await asCaller.rpc('admin_blocking_history', {
      p_user_id: id,
    })
    if (checkError) {
      // Say WHICH step failed and what the database said, instead of
      // serverError()'s one-size-fits-all sentence.
      //
      // "An unexpected error occurred" has now hidden three different causes on
      // this one button: a foreign-key refusal, a column that never existed,
      // and (nearly) a missing migration. Each time it cost a round trip to the
      // production logs to learn something the screen could have said. A
      // message naming the step is worth more than a tidy one.
      console.error('[staff] blocking-history check failed', {
        id, code: checkError.code, message: checkError.message, hint: checkError.hint,
      })
      const missing = checkError.code === 'PGRST202' || /schema cache|does not exist/i.test(checkError.message)
      return NextResponse.json(
        {
          error: missing
            ? `Could not check this account's history: the database is missing admin-removal-migration.sql, or its API cache is stale (${checkError.message}).`
            : `Could not check this account's history (${checkError.message}).`,
        },
        { status: 500 }
      )
    }

    const counts = (blocking ?? {}) as Record<string, number>
    if (Object.keys(counts).length > 0) {
      return NextResponse.json(
        {
          error:
            'This person has recorded work, so deleting the account would take it with them. Remove their access instead — they keep their history and can no longer reach any business.',
          blocking: counts,
          canRemoveAccessInstead: true,
        },
        { status: 409 }
      )
    }

    const { error } = await supabase.auth.admin.deleteUser(id)
    if (error) {
      // Nothing was blocking a moment ago, so this is genuinely unexpected -
      // but still say what the database said rather than swallowing it, because
      // the last time this path was opaque it cost an afternoon.
      console.error('[staff] delete failed', { id, message: error.message })
      return NextResponse.json(
        {
          error: `The account could not be deleted (${error.message}). Remove their access instead.`,
          canRemoveAccessInstead: true,
        },
        { status: 409 }
      )
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }
}
