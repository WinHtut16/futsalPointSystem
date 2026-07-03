import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
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
    const { username, password } = parsed.data

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

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: authData.user.id,
        phone: null,
        username,
        role: 'admin',
        total_points: 0,
      }, { onConflict: 'id' })

    if (profileError) {
      await supabase.auth.admin.deleteUser(authData.user.id)
      return serverError(profileError.message)
    }

    return NextResponse.json({ id: authData.user.id, username, role: 'admin' }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }
}
