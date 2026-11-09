import type { Metadata } from 'next'
import VenueAccountPage from '@/components/venue/VenueAccountPage'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'My points · ACJ Gaming',
  robots: { index: false, follow: false },
}

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams
  return <VenueAccountPage venue="game" tab={tab} />
}
