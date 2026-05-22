import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth'
import { IdParamSchema, RewardUpdateSchema, badRequest, parseJson } from '@/lib/schemas'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin()

    const idParsed = IdParamSchema.safeParse(await params)
    if (!idParsed.success) return badRequest(idParsed.error)
    const { id } = idParsed.data

    const parsed = RewardUpdateSchema.safeParse(await parseJson(request))
    if (!parsed.success) return badRequest(parsed.error)

    const updates: Record<string, unknown> = {
      ...parsed.data,
      updated_at: new Date().toISOString(),
    }

    const supabase = await createServiceClient()
    const { data, error } = await supabase
      .from('rewards')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    revalidateTag('rewards', 'default')
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin()

    const idParsed = IdParamSchema.safeParse(await params)
    if (!idParsed.success) return badRequest(idParsed.error)
    const { id } = idParsed.data

    const supabase = await createServiceClient()
    const { error } = await supabase.from('rewards').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    revalidateTag('rewards', 'default')
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
