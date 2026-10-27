import type { TranslationKey } from '@/lib/i18n'

// The park's places, in nav order. Shared by the desktop links (ParkNav)
// and the phone tab bar (ParkTabBar) so the two never drift apart.
export type ParkNavItem = {
  href: string
  key: TranslationKey // full label, desktop
  tab: TranslationKey // short label, phone tab bar
  exact?: boolean // active only on this exact path
}

export const PARK_NAV: ParkNavItem[] = [
  { href: '/', key: 'park.nav.park', tab: 'park.tab.park', exact: true },
  { href: '/pool', key: 'park.nav.pool', tab: 'park.tab.pool' },
  { href: '/futsal', key: 'park.nav.futsal', tab: 'park.tab.futsal' },
  { href: '/games', key: 'park.nav.games', tab: 'park.tab.games' },
  { href: '/billiards', key: 'park.nav.billiards', tab: 'park.tab.billiards' },
]

// Venue pages are set at night; nav chrome follows their ground.
export const DARK_PATHS = ['/games', '/billiards']

export const isCurrent = (pathname: string, item: ParkNavItem) =>
  item.exact ? pathname === item.href : pathname.startsWith(item.href)
