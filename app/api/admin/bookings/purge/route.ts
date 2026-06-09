import { requireSuperAdmin } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { serverError, badRequest } from '@/lib/schemas'
import { z } from 'zod'

const ALLOWED_DAYS = [30, 90, 180, 365] as const
const Schema = z.object({
  olderThanDays: z.union([z.literal(30), z.literal(90), z.literal(180), z.literal(365)]),
})

export async function GET(req: Request) {
  try {
    await requireSuperAdmin()
  } catch {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
  const url = new URL(req.url)
  const days = parseInt(url.searchParams.get('olderThanDays') ?? '', 10)
  if (!ALLOWED_DAYS.includes(days as (typeof ALLOWED_DAYS)[number])) {
    return new Response(JSON.stringify({ error: 'Invalid olderThanDays' }), { status: 400 })
  }

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffISO = cutoff.toISOString().slice(0, 10)

  const supabase = createServiceClient()
  const { count, error } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .lt('booking_date', cutoffISO)
    .in('status', ['cancelled', 'confirmed'])
  if (error) return serverError(error.message)
  return new Response(JSON.stringify({ count: count ?? 0 }), { status: 200 })
}

export async function POST(req: Request) {
  try {
    await requireSuperAdmin()
  } catch {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
  let body: unknown
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error)

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - parsed.data.olderThanDays)
  const cutoffISO = cutoff.toISOString().slice(0, 10)

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('bookings')
    .delete()
    .lt('booking_date', cutoffISO)
    .in('status', ['cancelled', 'confirmed'])
  if (error) return serverError(error.message)
  return new Response(JSON.stringify({ ok: true }), { status: 200 })
}
