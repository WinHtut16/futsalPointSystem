import type { Metadata } from 'next'
import BilliardsContent from '@/components/park/venue/BilliardsContent'

export const metadata: Metadata = {
  alternates: { canonical: '/billiards' },
  title: 'CueX Billiards',
  description: 'CueX Billiard and Snooker Club: three tables, snacks and cold drinks at MyaThida Park.',
}

export default function BilliardsPage() {
  return <BilliardsContent />
}
