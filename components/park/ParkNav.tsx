'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { DARK_PATHS, PARK_NAV, isCurrent } from '@/lib/park/nav'
import ParkLangToggle from './ParkLangToggle'

// Desktop: logo, the places as text links, language and Book futsal.
// Below lg the places move to the bottom tab bar (ParkTabBar).
export default function ParkNav() {
  const { t } = useLanguage()
  const pathname = usePathname()
  const dark = DARK_PATHS.some((p) => pathname.startsWith(p))

  const bar = dark
    ? 'bg-black/60 border-white/10 text-white'
    : 'bg-park-mist/90 border-park-jungle/10 text-park-jungle'
  const linkIdle = dark ? 'text-white/80 hover:text-white' : 'text-park-ink-soft hover:text-park-jungle'
  const linkOn = dark ? 'text-white' : 'text-park-jungle'

  const navLinks = PARK_NAV.map((item) => {
    const current = isCurrent(pathname, item)
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={current ? 'page' : undefined}
        className={`inline-flex min-h-[44px] items-center whitespace-nowrap font-medium transition-colors ${current ? `${linkOn} underline decoration-2 underline-offset-8` : linkIdle}`}
      >
        {t(item.key)}
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
    </header>
  )
}
