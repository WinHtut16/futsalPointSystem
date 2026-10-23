import { NextResponse } from 'next/server'
import { getGameBoard } from '@/lib/park/game-board.server'

// Public, read-only: the /games page polls this for the live TV board. It
// exposes screen numbers, tiers, free/in-use state and hourly rates only.
// Same-origin on purpose; browsers on some Myanmar networks cannot reach
// *.supabase.co directly (see lib/supabase/config.ts).
export const dynamic = 'force-dynamic'

export async function GET() {
  const board = await getGameBoard()
  if (!board) {
    return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
  return NextResponse.json(board, {
    // Never served from a cache: a stale copy would hide the statuses.
    headers: { 'Cache-Control': 'no-store' },
  })
}
