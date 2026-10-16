import type { Metadata } from 'next'
import './park.css'
import { parkFontVars } from '@/lib/park/fonts'
import ParkNav from '@/components/park/ParkNav'
import ParkFooter from '@/components/park/ParkFooter'

export const metadata: Metadata = {
  title: { default: 'MyaThida Park', template: '%s | MyaThida Park' },
  description:
    'A family park in Myanmar with a swimming pool, poolside restaurant, futsal court, game shop and billiards.',
  icons: { icon: '/logo_black.jpg' },
}

// Public showcase: no session, no Supabase reads. Static by default.
export default function ParkLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`park ${parkFontVars} flex min-h-screen flex-col`}>
      <ParkNav />
      <main id="main" className="flex-1">
        {children}
      </main>
      <ParkFooter />
    </div>
  )
}
