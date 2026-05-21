import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth'
import { usernameToAdminEmail } from '@/lib/utils'

export async function GET() {
  try {
    await requireSuperAdmin()
    const supabase = await createServiceClient()
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, role, created_at')
      .eq('role', 'admin')
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin()
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required.' }, { status: 400 })
    }
    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
    }
    if (!/^[a-zA-Z0-9._]{3,30}$/.test(username)) {
      return NextResponse.json({
        error: 'Username must be 3–30 characters: letters, numbers, dots, underscores only.',
      }, { status: 400 })
    }

    const supabase = await createServiceClient()

    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ error: 'Username already taken.' }, { status: 400 })
    }

    const email = usernameToAdminEmail(username)

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username },
    })
    if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })

    // The handle_new_user() trigger creates a profile with role='customer'.
    // Upsert immediately to set role='admin' and clear phone.
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
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    return NextResponse.json({ id: authData.user.id, username, role: 'admin' }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
