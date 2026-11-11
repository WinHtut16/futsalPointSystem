import type { Metadata } from 'next'
import VenueAccountPage from '@/components/venue/VenueAccountPage'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'My points · CueX Billiards',
  robots: { index: false, follow: false },
}

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams
  return <VenueAccountPage venue="billiards" tab={tab} />
}
