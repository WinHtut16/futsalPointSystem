import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { serverError } from '@/lib/schemas'
import { SESSIONS_PAGE, isVenue, parseVenueSessions } from '@/lib/venue-account'

// The signed-in customer's own played sessions at a venue, newest first.
// my_venue_sessions reads auth.uid() itself, so the user's own client is used.
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const app = searchParams.get('app')
  if (!isVenue(app)) return NextResponse.json({ error: 'Unknown business.' }, { status: 400 })

  const before = searchParams.get('before')
  if (before !== null && Number.isNaN(Date.parse(before))) {
    return NextResponse.json({ error: 'Invalid cursor.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('my_venue_sessions', {
    p_app: app,
    p_before: before,
    p_limit: SESSIONS_PAGE + 1,
  })
  if (error) return serverError(error.message)

  const rows = parseVenueSessions(data)
  const hasMore = rows.length > SESSIONS_PAGE
  const items = rows.slice(0, SESSIONS_PAGE)
  const nextCursor = hasMore ? items[items.length - 1].played_at : null
  return NextResponse.json({ items, hasMore, nextCursor })
}
