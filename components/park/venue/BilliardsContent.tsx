'use client'

import { useLanguage } from '@/lib/i18n/LanguageContext'
import { BILLIARDS, HOURS, PARK, billiardsOpening } from '@/lib/park/content'
import { formatAmount } from '@/lib/park/time'
import BreakTable, { TableSvg } from './BreakTable'
import OpeningBadge from '../OpeningBadge'
import ViberLink from '../ViberLink'
import { MenuList, VenueHero, VenueStrip, type Theme } from './VenueParts'

// Oxblood and brass, the billiards room's colours from its admin system.
const theme: Theme = {
  ground: 'bg-[#1f1214] text-[#f6ece6]',
  panel: 'bg-[#2a1719]',
  muted: 'text-[#e2ccd2]',
  accent: 'text-venue-brass',
  rule: 'divide-white/15 border-white/15',
  primaryBtn: 'bg-venue-brass text-[#1f1214] hover:bg-[#e8c88a]',
  secondaryBtn: 'border-[1.5px] border-venue-brass text-[#f6ece6] hover:bg-white/10',
}

export default function BilliardsContent() {
  const { t, lang } = useLanguage()

  return (
    <>
      <VenueHero
        theme={theme}
        title="park.billiards.title"
        lead={billiardsOpening() ? 'park.billiards.openingBody' : 'park.billiards.lead'}
        badge={<OpeningBadge />}
        media={
          // Mid-game in the hero; the racked table waits further down with its Break button.
          <div className="flex aspect-[5/4] items-center justify-center rounded-[28px] bg-[#2a1719] p-8">
            <TableSvg broken />
          </div>
        }
        primary={{ href: PARK.viberUrl, label: 'park.billiards.ctaAsk' }}
        secondary={{ href: '#menu', label: 'park.billiards.ctaMenu' }}
        glow="shadow-[0_30px_90px_rgb(217_178_106/0.22)]"
      />

      <section aria-labelledby="billiards-table" className={`${theme.panel} py-20 text-[#f6ece6] md:py-24`}>
        <div className="mx-auto grid max-w-[1200px] items-center gap-10 px-4 md:px-8 lg:grid-cols-[5fr_7fr] lg:gap-14">
          <div className="flex flex-col gap-4">
            <h2 id="billiards-table" className="park-display text-[34px] leading-[1.1] md:text-[42px]">
              {t('park.billiards.tableTitle')}
            </h2>
            <p className={`max-w-[40ch] text-[17px] leading-relaxed ${theme.muted}`}>{t('park.billiards.tableBody')}</p>
            <div className="mt-4 flex flex-col gap-1 border-t border-white/15 pt-5">
              <h3 className="font-semibold">{t('park.billiards.rateTitle')}</h3>
              <p className="park-display text-3xl text-venue-brass">
                {t('park.billiards.tables', { n: formatAmount(BILLIARDS.tables, lang) })}
              </p>
              <p className={theme.muted}>
                {BILLIARDS.ratePerHour ? (
                  t('park.billiards.rateValue', { price: formatAmount(BILLIARDS.ratePerHour, lang) })
                ) : (
                  <ViberLink className="underline decoration-white/30 underline-offset-4 hover:text-white">
                    {t('park.billiards.rateAsk')}
                  </ViberLink>
                )}
              </p>
            </div>
          </div>
          <BreakTable />
        </div>
      </section>

      <section id="menu" aria-labelledby="billiards-menu" className={`${theme.ground} scroll-mt-32 py-20 md:py-24`}>
        <div className="mx-auto max-w-[1200px] px-4 md:px-8">
          <h2 id="billiards-menu" className="park-display text-[34px] md:text-[42px]">
            {t('park.billiards.menuTitle')}
          </h2>
          <div className="mt-8 grid gap-12 md:grid-cols-2">
            <div>
              <h3 className="mb-2 font-semibold text-venue-brass">{t('park.billiards.drinks')}</h3>
              <MenuList theme={theme} items={BILLIARDS.menu.drinks} columns={1} />
            </div>
            <div>
              <h3 className="mb-2 font-semibold text-venue-brass">{t('park.billiards.food')}</h3>
              <MenuList theme={theme} items={BILLIARDS.menu.food} columns={1} />
            </div>
          </div>
          <p className="mt-6 text-sm text-[#bfa8ae]">{t('park.venue.prices')}</p>
        </div>
      </section>

      <VenueStrip
        band="bg-venue-brass text-[#1f1214]"
        hours={HOURS.billiards}
        also={{ href: '/games', label: 'park.billiards.alsoGames' }}
      />
    </>
  )
}
