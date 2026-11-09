import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { badRequest, parseJson, serverError } from '@/lib/schemas'
import { isLoyaltyApp } from '@/lib/loyalty'
import { guardResponse, requireLoyaltyRole } from '@/lib/loyalty.server'

const Schema = z.object({ ids: z.array(z.string().uuid()).min(1).max(500) })

/**
 * Clear resolved redemption history for one business. Owner only, resolved
 * rows only, and only rows of THIS business - ids from elsewhere are ignored.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ app: string }> }) {
  const { app } = await params
  if (!isLoyaltyApp(app)) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

  try {
    await requireLoyaltyRole(app, 'superadmin')
  } catch (e) {
    return guardResponse(e)
  }

  const parsed = Schema.safeParse(await parseJson(request))
  if (!parsed.success) return badRequest(parsed.error)

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('redemption_requests')
    .delete()
    .in('id', parsed.data.ids)
    .eq('app', app)
    .in('status', ['approved', 'rejected', 'cancelled'])

  if (error) return serverError(error.message)
  return NextResponse.json({ ok: true })
}
