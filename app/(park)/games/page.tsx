import type { Metadata } from 'next'
import GamesContent from '@/components/park/venue/GamesContent'
import { arcadeFontVar } from '@/lib/park/arcade-font'

export const metadata: Metadata = {
  alternates: { canonical: '/games' },
  title: 'ACJ Gaming',
  description: 'ACJ Gaming at MyaThida Park: PS4 and PS5 on nine screens plus a private VIP room. From 3,000 MMK an hour.',
}

export default function GamesPage() {
  // .arcade: the night-time neon theme, scoped to this page (park.css).
  return (
    <div className={`arcade ${arcadeFontVar}`}>
      <GamesContent />
    </div>
  )
}
