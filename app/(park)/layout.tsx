import type { Metadata } from 'next'
import './park.css'
import { parkFontVars } from '@/lib/park/fonts'
import ParkNav from '@/components/park/ParkNav'
import ParkFooter from '@/components/park/ParkFooter'
import ParkTabBar from '@/components/park/ParkTabBar'
import SkipLink from '@/components/park/SkipLink'
import AnimationGuard from '@/components/park/AnimationGuard'
import { SITE_URL } from '@/lib/park/site'

const DESCRIPTION =
  'A family park in Yangon with a covered pool, poolside dining, a night market lane, a futsal court, ACJ Gaming and billiards.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'MyaThida Park', template: '%s | MyaThida Park' },
  description: DESCRIPTION,
  applicationName: 'MyaThida Park',
  icons: { icon: '/logo_black.jpg', apple: '/logo_black.jpg' },
  openGraph: {
    type: 'website',
    siteName: 'MyaThida Park',
    title: 'MyaThida Park',
    description: DESCRIPTION,
    locale: 'en_US',
    alternateLocale: ['my_MM'],
  },
  twitter: { card: 'summary_large_image' },
}

// Public showcase: no session. The only database read is /games' live TV
// board (server-side, cached; lib/park/game-board.server.ts). (Still rendered per
// request, because the root layout reads the `lang` cookie.)
export default function ParkLayout({ children }: { children: React.ReactNode }) {
  return (
    // Bottom padding below lg keeps the footer clear of the fixed tab bar.
    <div className={`park ${parkFontVars} flex min-h-screen flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0`}>
      <SkipLink />
      <ParkNav />
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <ParkFooter />
      <ParkTabBar />
      <AnimationGuard />
    </div>
  )
}
