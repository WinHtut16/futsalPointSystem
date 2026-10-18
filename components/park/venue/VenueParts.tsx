'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { TranslationKey } from '@/lib/i18n'
import type { Hours, MenuItemKey } from '@/lib/park/content'
import { formatAmount, formatHour } from '@/lib/park/time'
import type { PhotoKey } from '@/lib/park/photos'
import ParkPhoto from '../ParkPhoto'
import ViberLink from '../ViberLink'

// Building blocks shared by the game shop and billiards pages. Each page
// passes its own palette as a Theme so the two rooms feel like different
// places that belong to the same park.
export type Theme = {
  ground: string // page background + base text
  panel: string // alternate band background
  muted: string // secondary text
  accent: string // prices and highlights (text colour)
  rule: string // divider colour
  primaryBtn: string
  secondaryBtn: string
}

const btnBase = 'inline-flex min-h-[48px] items-center rounded-full px-6 font-semibold transition-colors'

export function VenueHero({
  theme,
  title,
  lead,
  photo,
  media,
  badge,
  primary,
  secondary,
  glow,
  sectionClass = '',
  titleClass = 'park-rise park-display',
}: {
  theme: Theme
  title: TranslationKey
  lead: TranslationKey
  /** A photo slot, or `media` for anything else (an illustration). */
  photo?: PhotoKey
  media?: React.ReactNode
  /** Shown above the title, e.g. an opening date. */
  badge?: React.ReactNode
  primary: { href: string; label: TranslationKey }
  secondary: { href: string; label: TranslationKey }
  glow: string // shadow class: the room's light spilling around the photo
  /** Extra classes on the hero band (e.g. an ambient light wash). */
  sectionClass?: string
  /** Face and entrance for the title; defaults to the park display serif. */
  titleClass?: string
}) {
  const { t, lang } = useLanguage()
  return (
    <section className={`${theme.ground} ${sectionClass}`}>
      <div className="mx-auto grid max-w-[1200px] items-center gap-10 px-4 pb-20 pt-10 md:px-8 md:pt-14 lg:grid-cols-2 lg:gap-14">
        <div className="flex flex-col gap-6">
          {badge && (
            <div className="park-rise" style={{ animationDelay: '40ms' }}>
              {badge}
            </div>
          )}
          <h1
            className={`${titleClass} ${
              lang === 'my' ? 'text-[34px] sm:text-5xl' : 'max-w-[14ch] text-[44px] leading-[1.03] sm:text-6xl lg:text-[68px]'
            }`}
            style={{ animationDelay: '100ms' }}
          >
            {t(title)}
          </h1>
          <p className={`park-rise max-w-[36ch] text-lg leading-relaxed ${theme.muted}`} style={{ animationDelay: '240ms' }}>
            {t(lead)}
          </p>
          <div className="park-rise flex flex-wrap gap-3" style={{ animationDelay: '380ms' }}>
            <HeroLink href={primary.href} className={`${btnBase} ${theme.primaryBtn}`}>
              {t(primary.label)}
            </HeroLink>
            <HeroLink href={secondary.href} className={`${btnBase} ${theme.secondaryBtn}`}>
              {t(secondary.label)}
            </HeroLink>
          </div>
        </div>
        {photo ? (
          <ParkPhoto
            photo={photo}
            priority
            sizes="(min-width: 1024px) 580px, 92vw"
            className={`park-rise aspect-[5/4] rounded-[28px] ${glow}`}
          />
        ) : (
          <div className={`park-rise rounded-[28px] ${glow}`}>{media}</div>
        )}
      </div>
    </section>
  )
}

// In-page anchors stay plain links; Viber links go through openViber().
function HeroLink({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
  return href.startsWith('viber:') ? (
    <ViberLink className={className}>{children}</ViberLink>
  ) : (
    <a href={href} className={className}>
      {children}
    </a>
  )
}

export function PriceRows({ theme, rows }: { theme: Theme; rows: [TranslationKey, number][] }) {
  const { t, lang } = useLanguage()
  return (
    <dl className={`divide-y text-[17px] ${theme.rule}`}>
      {rows.map(([label, price]) => (
        <div key={label} className="flex items-baseline justify-between gap-4 py-3.5">
          <dt>{t(label)}</dt>
          <dd className={`whitespace-nowrap font-bold ${theme.accent}`}>
            {t('park.venue.perHour', { price: formatAmount(price, lang) })}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function MenuList({
  theme,
  items,
  columns = 2,
}: {
  theme: Theme
  items: readonly { key: MenuItemKey; price: number }[]
  columns?: 1 | 2
}) {
  const { t, lang } = useLanguage()
  return (
    <ul className={`grid gap-x-10 ${columns === 2 ? 'sm:grid-cols-2' : ''}`}>
      {items.map(({ key, price }) => (
        <li key={key} className={`flex items-baseline justify-between gap-3 border-b py-3 ${theme.rule}`}>
          <span>{t(`park.item.${key}` as TranslationKey)}</span>
          <span className={`tabular-nums ${theme.muted}`}>{formatAmount(price, lang)}</span>
        </li>
      ))}
    </ul>
  )
}

export function VenueStrip({
  band,
  hours,
  also,
}: {
  band: string // background + text classes for the closing band
  hours: Hours | null
  also: { href: string; label: TranslationKey }
}) {
  const { t, lang } = useLanguage()
  const heading = hours
    ? t('park.venue.openDaily', {
        range: t('park.visit.range', { open: formatHour(hours.open, lang), close: formatHour(hours.close, lang) }),
      })
    : t('park.venue.askHours')

  return (
    <section className={band}>
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-6 px-4 py-14 md:px-8">
        <div>
          <h2 className="park-display text-3xl md:text-[34px]">{heading}</h2>
          <p className="mt-2">{t('park.venue.inside')}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href={also.href} className={`${btnBase} bg-black/85 text-white hover:bg-black`}>
            {t(also.label)}
          </Link>
          <Link href="/" className={`${btnBase} border-[1.5px] border-current hover:bg-black/10`}>
            {t('park.venue.back')}
          </Link>
        </div>
      </div>
    </section>
  )
}
