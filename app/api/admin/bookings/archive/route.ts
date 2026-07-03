import { requireAnyAdmin } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { serverError, badRequest } from '@/lib/schemas'
import { z } from 'zod'

const Schema = z.object({ ids: z.array(z.string().uuid()).min(1).max(100) })

export async function POST(req: Request) {
  try {
    await requireAnyAdmin()
  } catch {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
  let body: unknown
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error)

  const supabase = createServiceClient()

  // Guard: only terminal bookings may be archived. Fetch statuses first.
  const { data: rows, error: fetchErr } = await supabase
    .from('bookings')
    .select('id, status')
    .in('id', parsed.data.ids)
  if (fetchErr) return serverError(fetchErr.message)

  const active = (rows ?? []).filter(
    (r) => r.status === 'pending' || r.status === 'confirmed'
  )
  if (active.length > 0) {
    return new Response(
      JSON.stringify({ error: 'Cannot archive active bookings. Cancel or close them first.' }),
      { status: 400 }
    )
  }

  const { error } = await supabase
    .from('bookings')
    .update({ is_archived: true })
    .in('id', parsed.data.ids)
    .in('status', ['cancelled', 'closed'])
  if (error) return serverError(error.message)
  return new Response(JSON.stringify({ ok: true }), { status: 200 })
}
