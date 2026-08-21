import { createBrowserClient } from '@supabase/ssr'
import { fetchWithTimeout, SUPABASE_CLIENT_TIMEOUT_MS } from '@/lib/fetchWithTimeout'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: (input, init) => fetchWithTimeout(input, init, SUPABASE_CLIENT_TIMEOUT_MS),
      },
    }
  )
}
