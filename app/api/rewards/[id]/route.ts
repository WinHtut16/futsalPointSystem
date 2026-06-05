import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentUser, requireAnyAdmin, requireSuperAdmin } from '@/lib/auth'
import { IdParamSchema, RewardToggleSchema, RewardUpdateSchema, badRequest, parseJson, serverError } from '@/lib/schemas'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentUser()
  if (!profile) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const { id } = await params
  const idParsed = IdParamSchema.safeParse({ id })
  if (!idParsed.success) return badRequest(idParsed.error)

  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('rewards')
    .select('*')
    .eq('id', idParsed.data.id)
    .single()

  if (error?.code === 'PGRST116' || !data) {
    return NextResponse.json({ error: 'Reward not found.' }, { status: 404 })
  }
  if (error) return serverError(error.message)

  if (data.is_deleted && profile.role !== 'superadmin') {
    return NextResponse.json({ error: 'Reward not found.' }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Fail-fast: reject unauthenticated / non-admin callers before touching the body
    await requireAnyAdmin()

    const idParsed = IdParamSchema.safeParse(await params)
    if (!idParsed.success) return badRequest(idParsed.error)
    const { id } = idParsed.data

    const body = await parseJson(request)
    const toggleParsed = RewardToggleSchema.safeParse(body)

    let updates: Record<string, unknown>

    if (toggleParsed.success) {
      // Toggle-only: any admin — already authorized above
      updates = { is_active: toggleParsed.data.is_active, updated_at: new Date().toISOString() }
    } else {
      // Full update: superadmin only — secondary role check
      await requireSuperAdmin()
      const parsed = RewardUpdateSchema.safeParse(body)
      if (!parsed.success) return badRequest(parsed.error)
      updates = { ...parsed.data, updated_at: new Date().toISOString() }
    }

    const supabase = await createServiceClient()
    const { data, error } = await supabase
      .from('rewards')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error?.code === 'PGRST116') {
      return NextResponse.json({ error: 'Reward not found.' }, { status: 404 })
    }
    if (error) return serverError(error.message)
    revalidateTag('rewards', 'default')
    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin()

    const idParsed = IdParamSchema.safeParse(await params)
    if (!idParsed.success) return badRequest(idParsed.error)
    const { id } = idParsed.data

    const supabase = await createServiceClient()
    const { error } = await supabase
      .from('rewards')
      .update({ is_deleted: true, is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return serverError(error.message)
    revalidateTag('rewards', 'default')
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }
}
