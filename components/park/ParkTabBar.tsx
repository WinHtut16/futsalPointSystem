'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CircleDot, Gamepad2, Goal, Trees, Waves, type LucideIcon } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { DARK_PATHS, PARK_NAV, isCurrent } from '@/lib/park/nav'

// Phones and tablets: every place in one thumb-reach bar at the bottom, so
// nothing hides off-screen the way the old swipeable top row did. Desktop
// uses the text links in ParkNav instead.

const ICONS: Record<string, LucideIcon> = {
  '/': Trees,
  '/pool': Waves,
  '/futsal': Goal,
  '/games': Gamepad2,
  '/billiards': CircleDot,
}

export default function ParkTabBar() {
  const { t } = useLanguage()
  const pathname = usePathname()
  const dark = DARK_PATHS.some((p) => pathname.startsWith(p))

  return (
    <nav
      aria-label={t('park.nav.label')}
      className={`fixed inset-x-0 bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden ${
        dark ? 'border-white/10 bg-black/75 text-white' : 'border-park-jungle/10 bg-park-mist/95 text-park-ink-soft'
      }`}
    >
      <ul className="mx-auto grid h-16 max-w-[640px] grid-cols-5">
        {PARK_NAV.map((item) => {
          const Icon = ICONS[item.href]
          const current = isCurrent(pathname, item)
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current ? 'page' : undefined}
                className={`flex h-full flex-col items-center justify-center gap-1 text-[12px] font-medium leading-none transition-colors ${
                  current ? (dark ? 'text-white' : 'text-park-jungle') : dark ? 'text-white/70' : ''
                }`}
              >
                <span
                  className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
                    current ? (dark ? 'bg-white/15' : 'bg-park-jungle/10') : ''
                  }`}
                >
                  <Icon size={20} strokeWidth={current ? 2.4 : 2} aria-hidden="true" />
                </span>
                <span className="max-w-full truncate px-1">{t(item.tab)}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
