import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { RewardCreateSchema, badRequest, parseJson, serverError } from '@/lib/schemas'
import { isLoyaltyApp } from '@/lib/loyalty'
import { guardResponse, requireLoyaltyRole } from '@/lib/loyalty.server'

/**
 * Create a reward for the game shop or billiards. Owner of THAT business only.
 * The business comes from the URL and is written onto the row, never read
 * from the body, so a billiards manager cannot create a game reward.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ app: string }> }) {
  const { app } = await params
  if (!isLoyaltyApp(app)) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

  let admin
  try {
    admin = await requireLoyaltyRole(app, 'superadmin')
  } catch (e) {
    return guardResponse(e)
  }

  const parsed = RewardCreateSchema.safeParse(await parseJson(request))
  if (!parsed.success) return badRequest(parsed.error)
  const { name, name_my, description, description_my, points_cost, stock } = parsed.data

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('rewards')
    .insert({
      name,
      name_my: name_my ?? null,
      description: description ?? null,
      description_my: description_my ?? null,
      points_cost,
      stock: stock ?? null,
      app,
      // Service role: auth.uid() is NULL, so the audit trigger reads this.
      updated_by: admin.id,
    })
    .select()
    .single()

  if (error) return serverError(error.message)
  revalidateTag('rewards', 'default')
  return NextResponse.json(data, { status: 201 })
}
