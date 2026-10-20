import type { Metadata } from 'next'
import GamesContent from '@/components/park/venue/GamesContent'
import { arcadeFontVar } from '@/lib/park/arcade-font'
import { getGameBoard, getGameShelf } from '@/lib/park/game-board.server'
import { DEMO_SHELF } from '@/lib/park/game-demo'

export const metadata: Metadata = {
  alternates: { canonical: '/games' },
  title: 'ACJ Gaming',
  icons: { icon: '/images/acj/acj-icon-192.png', apple: '/images/acj/acj-icon-512.png' },
  description: 'ACJ Gaming at MyaThida Park: PS4 and PS5 on nine screens plus a private VIP room. From 3,000 MMK an hour.',
}

export default async function GamesPage() {
  // Live TVs and rates (cached 15 s; null falls back to the static plan) and
  // the games on the shelf (cached 60 s, expired at once by a save on the
  // admin's Games screen; empty shows a teaser), both from the game admin.
  const [board, real] = await Promise.all([getGameBoard(), getGameShelf()])
  // Local development only: PARK_GAMES_DEMO=1 fills an empty list with
  // lib/park/game-demo.ts so the library can be built and checked.
  const demo = process.env.NODE_ENV !== 'production' && process.env.PARK_GAMES_DEMO === '1' && real.length === 0
  const shelf = demo ? DEMO_SHELF : real
  // .arcade: the night-time neon theme, scoped to this page (park.css).
  return (
    <div className={`arcade ${arcadeFontVar}`}>
      <GamesContent initialBoard={board} shelf={shelf} />
    </div>
  )
}
