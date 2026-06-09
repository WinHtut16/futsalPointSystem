import { requireSuperAdmin } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { serverError, badRequest } from '@/lib/schemas'
import { z } from 'zod'

const Schema = z.object({ ids: z.array(z.string().uuid()).min(1).max(100) })

// Only allows deletion of already-archived rows (two-step safety).
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

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('bookings')
    .delete()
    .in('id', parsed.data.ids)
    .eq('is_archived', true)
  if (error) return serverError(error.message)
  return new Response(JSON.stringify({ ok: true }), { status: 200 })
}
