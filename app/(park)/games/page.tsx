import type { Metadata } from 'next'
import GamesContent from '@/components/park/venue/GamesContent'

export const metadata: Metadata = {
  alternates: { canonical: '/games' },
  title: 'Game shop',
  description: 'PS4 and PS5 on nine screens plus a private VIP room at MyaThida Park. From 3,000 MMK an hour.',
}

export default function GamesPage() {
  return <GamesContent />
}
