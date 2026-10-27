import type { Metadata } from 'next'
import PoolContent from '@/components/park/venue/PoolContent'

export const metadata: Metadata = {
  alternates: { canonical: '/pool' },
  title: 'Pool',
  description:
    'Mini Water Boom, the covered pool at MyaThida Park: 1 to 4 ft deep, open 9 AM to 5:30 PM (closed Mondays). Entry prices and pool rules.',
}

export default function PoolPage() {
  return <PoolContent />
}
