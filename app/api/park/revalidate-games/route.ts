import { timingSafeEqual } from 'node:crypto'
import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'

// Called by the game admin (MyaThida_Game, src/app/actions/titles.ts) after a
// save on its Games screen, so /games shows the change on the next load
// instead of after the 60 s shelf cache. Server to server only: the caller
// must send the shared secret (PARK_REVALIDATE_SECRET, set on both Vercel
// projects) in x-park-revalidate. All it can do is expire that one cache.
export const dynamic = 'force-dynamic'

function matches(given: string | null, expected: string): boolean {
  if (!given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(req: Request) {
  const secret = process.env.PARK_REVALIDATE_SECRET
  if (!secret || secret.length < 16) {
    return NextResponse.json({ error: 'not configured' }, { status: 503 })
  }
  if (!matches(req.headers.get('x-park-revalidate'), secret)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  revalidateTag('park-game-shelf', 'default')
  return NextResponse.json({ ok: true })
}
