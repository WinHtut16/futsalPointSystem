import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from Server Component — middleware handles session refresh
          }
        },
      },
    }
  )
}

export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/**
 * Sends a Realtime broadcast to the booking-slot-updates channel via the
 * Supabase REST API (no WebSocket, no RLS — works for all users including
 * anonymous). Called by API routes after any booking or closure change so
 * the public /book page receives an event-driven slot refresh.
 *
 * Non-blocking: resolves quickly, errors are swallowed (notification is
 * best-effort and does not affect the core booking operation).
 */
export async function broadcastSlotChange(date: string): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 2000)
  try {
    await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
      },
      body: JSON.stringify({
        messages: [
          { topic: 'realtime:booking-slot-updates', event: 'slot_changed', payload: { date } },
        ],
      }),
      signal: controller.signal,
    })
  } catch {
    // Broadcast failure is non-critical — UI relies on realtime events only
  } finally {
    clearTimeout(timer)
  }
}
