'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { TranslationKey } from '@/lib/i18n'
import ParkLangToggle from './ParkLangToggle'

const links: { href: string; key: TranslationKey; match?: string }[] = [
  { href: '/#pool', key: 'park.nav.poolFood' },
  { href: '/futsal', key: 'park.nav.futsal', match: '/futsal' },
  { href: '/games', key: 'park.nav.games', match: '/games' },
  { href: '/billiards', key: 'park.nav.billiards', match: '/billiards' },
  { href: '/#visit', key: 'park.nav.visit' },
]

// Venue pages are set at night; the nav follows their ground.
const DARK_PATHS = ['/games', '/billiards']

export default function ParkNav() {
  const { t } = useLanguage()
  const pathname = usePathname()
  const dark = DARK_PATHS.some((p) => pathname.startsWith(p))

  const bar = dark
    ? 'bg-park-night/90 border-white/10 text-white'
    : 'bg-park-mist/90 border-park-jungle/10 text-park-jungle'
  const linkIdle = dark ? 'text-white/80 hover:text-white' : 'text-park-ink-soft hover:text-park-jungle'
  const linkOn = dark ? 'text-white' : 'text-park-jungle'

  const navLinks = links.map(({ href, key, match }) => {
    const current = match ? pathname.startsWith(match) : false
    return (
      <Link
        key={href}
        href={href}
        aria-current={current ? 'page' : undefined}
        className={`whitespace-nowrap py-2 font-medium transition-colors ${current ? `${linkOn} underline decoration-2 underline-offset-8` : linkIdle}`}
      >
        {t(key)}
      </Link>
    )
  })

  return (
    <header className={`sticky top-0 z-30 border-b backdrop-blur-md ${bar}`}>
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-4 md:h-[72px] md:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label={t('park.nav.home')}>
          <Image
            src={dark ? '/logo_white.jpg' : '/logo_black.jpg'}
            alt=""
            width={232}
            height={211}
            className="h-9 w-auto rounded-md object-contain"
            priority
          />
          <span className="park-display hidden text-xl min-[380px]:inline">{t('park.brand')}</span>
        </Link>

        <nav aria-label={t('park.nav.label')} className="hidden items-center gap-7 text-[15px] lg:flex">
          {navLinks}
        </nav>

        <div className="flex items-center gap-2.5">
          <ParkLangToggle dark={dark} />
          <Link
            href="/book"
            className={`hidden min-h-[44px] items-center rounded-full px-5 text-[15px] font-semibold transition-colors sm:inline-flex ${
              dark ? 'bg-white text-park-ink hover:bg-park-sun' : 'bg-park-jungle text-white hover:bg-park-jungle-deep'
            }`}
          >
            {t('park.nav.bookFutsal')}
          </Link>
        </div>
      </div>

      {/* Phone and tablet: the same links as a swipeable row, no hidden menu. */}
      <nav
        aria-label={t('park.nav.label')}
        className="park-scroll-x mx-auto flex max-w-[1200px] gap-6 overflow-x-auto px-4 pb-2 text-[15px] md:px-8 lg:hidden"
      >
        {navLinks}
      </nav>
    </header>
  )
}
