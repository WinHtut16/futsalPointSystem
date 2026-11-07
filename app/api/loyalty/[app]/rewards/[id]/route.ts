import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { IdParamSchema, RewardToggleSchema, RewardUpdateSchema, badRequest, parseJson, serverError } from '@/lib/schemas'
import { isLoyaltyApp } from '@/lib/loyalty'
import { guardResponse, requireLoyaltyRole } from '@/lib/loyalty.server'

/**
 * Edit / switch on-off / soft-delete one game or billiards reward.
 *
 * Every write is filtered by BOTH id and app, so the id of another
 * business's reward simply matches nothing (404) - the permission and the
 * row can never come from different businesses.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ app: string; id: string }> }) {
  const { app, id: rawId } = await params
  if (!isLoyaltyApp(app)) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

  const idParsed = IdParamSchema.safeParse({ id: rawId })
  if (!idParsed.success) return badRequest(idParsed.error)

  const body = await parseJson(request)
  const toggle = RewardToggleSchema.safeParse(body)

  let updates: Record<string, unknown>
  try {
    if (toggle.success) {
      // Switching a reward on/off: any admin of this business, as in futsal.
      const admin = await requireLoyaltyRole(app, 'admin')
      updates = { is_active: toggle.data.is_active, updated_at: new Date().toISOString(), updated_by: admin.id }
    } else {
      const admin = await requireLoyaltyRole(app, 'superadmin')
      const parsed = RewardUpdateSchema.safeParse(body)
      if (!parsed.success) return badRequest(parsed.error)
      updates = { ...parsed.data, updated_at: new Date().toISOString(), updated_by: admin.id }
    }
  } catch (e) {
    return guardResponse(e)
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('rewards')
    .update(updates)
    .eq('id', idParsed.data.id)
    .eq('app', app)
    .select()
    .maybeSingle()

  if (error) return serverError(error.message)
  if (!data) return NextResponse.json({ error: 'Reward not found.' }, { status: 404 })
  revalidateTag('rewards', 'default')
  return NextResponse.json(data)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ app: string; id: string }> }) {
  const { app, id: rawId } = await params
  if (!isLoyaltyApp(app)) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

  const idParsed = IdParamSchema.safeParse({ id: rawId })
  if (!idParsed.success) return badRequest(idParsed.error)

  let admin
  try {
    admin = await requireLoyaltyRole(app, 'superadmin')
  } catch (e) {
    return guardResponse(e)
  }

  // Soft delete: the row stays so past redemptions keep their reward name.
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('rewards')
    .update({ is_deleted: true, is_active: false, updated_at: new Date().toISOString(), updated_by: admin.id })
    .eq('id', idParsed.data.id)
    .eq('app', app)
    .select('id')
    .maybeSingle()

  if (error) return serverError(error.message)
  if (!data) return NextResponse.json({ error: 'Reward not found.' }, { status: 404 })
  revalidateTag('rewards', 'default')
  return NextResponse.json({ success: true })
}
