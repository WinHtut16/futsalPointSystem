import type { Metadata } from 'next'
import GamesContent from '@/components/park/venue/GamesContent'
import { arcadeFontVar } from '@/lib/park/arcade-font'
import { getGameBoard, getGameShelf } from '@/lib/park/game-board.server'

export const metadata: Metadata = {
  alternates: { canonical: '/games' },
  title: 'ACJ Gaming',
  description: 'ACJ Gaming at MyaThida Park: PS4 and PS5 on nine screens plus a private VIP room. From 3,000 MMK an hour.',
}

export default async function GamesPage() {
  // Live TVs and rates (cached 15 s; null falls back to the static plan) and
  // the games on the shelf (cached 60 s; empty hides the section), both from
  // the game admin.
  const [board, shelf] = await Promise.all([getGameBoard(), getGameShelf()])
  // .arcade: the night-time neon theme, scoped to this page (park.css).
  return (
    <div className={`arcade ${arcadeFontVar}`}>
      <GamesContent initialBoard={board} shelf={shelf} />
    </div>
  )
}
