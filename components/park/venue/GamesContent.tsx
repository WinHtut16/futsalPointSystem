'use client'

import { useLanguage } from '@/lib/i18n/LanguageContext'
import { GAME, HOURS, PARK } from '@/lib/park/content'
import { formatAmount } from '@/lib/park/time'
import GameFloor from './GameFloor'
import { MenuList, PriceRows, VenueHero, VenueStrip, type Theme } from './VenueParts'

// Console blue with amber, the game shop's own colours from its admin system.
const theme: Theme = {
  ground: 'bg-[#0c1530] text-[#e8edfa]',
  panel: 'bg-[#111d40]',
  muted: 'text-[#b9c5e4]',
  accent: 'text-venue-amber',
  rule: 'divide-white/15 border-white/15',
  primaryBtn: 'bg-venue-amber text-[#1a1300] hover:bg-[#ffd27a]',
  secondaryBtn: 'border-[1.5px] border-[#5b82e0] text-[#e8edfa] hover:bg-white/10',
}

export default function GamesContent() {
  const { t, lang } = useLanguage()
  const n = (x: number) => formatAmount(x, lang)

  return (
    <>
      <VenueHero
        theme={theme}
        title="park.games.title"
        lead="park.games.lead"
        photo="gameRoom"
        primary={{ href: '#rates', label: 'park.games.ctaRates' }}
        secondary={{ href: PARK.viberUrl, label: 'park.games.ctaVip' }}
        glow="shadow-[0_30px_90px_rgb(47_95_208/0.4)]"
      />

      <section aria-labelledby="games-floor" className={`${theme.panel} py-20 text-[#e8edfa] md:py-24`}>
        <div className="mx-auto grid max-w-[1200px] items-start gap-10 px-4 md:px-8 lg:grid-cols-[5fr_7fr] lg:gap-14">
          <div className="flex flex-col gap-4">
            <h2 id="games-floor" className="park-display text-[34px] leading-[1.1] md:text-[42px]">
              {t('park.games.floorTitle')}
            </h2>
            <p className={`max-w-[42ch] text-[17px] leading-relaxed ${theme.muted}`}>{t('park.games.floorBody')}</p>
            <ul className="flex flex-wrap gap-5 pt-1 text-[15px]" aria-hidden="true">
              <li className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded bg-[#3b5ba8]" />{t('park.games.ps4')}</li>
              <li className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded bg-[#5b82e0]" />{t('park.games.ps5')}</li>
              <li className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded bg-venue-amber" />{t('park.games.vip')}</li>
            </ul>
          </div>
          <GameFloor />
        </div>
      </section>

      <section id="rates" className={`${theme.ground} scroll-mt-32 py-20 md:py-24`}>
        <div className="mx-auto grid max-w-[1200px] items-start gap-14 px-4 md:px-8 lg:grid-cols-2">
          <div className="flex flex-col gap-5">
            <h2 className="park-display text-[34px] md:text-[42px]">{t('park.games.ratesTitle')}</h2>
            <PriceRows
              theme={theme}
              rows={[
                ['park.games.ratePs4', GAME.rates.ps4],
                ['park.games.ratePs5', GAME.rates.ps5],
                ['park.games.rateVip', GAME.rates.vip],
              ]}
            />
            <p className="text-[15px] leading-relaxed text-[#9aa9cf]">
              {t('park.games.rules', { min: n(GAME.minimumMinutes), block: n(GAME.blockMinutes), grace: n(GAME.graceMinutes) })}
            </p>
          </div>
          <div className="flex flex-col gap-5">
            <h2 className="park-display text-[34px] md:text-[42px]">{t('park.games.snacksTitle')}</h2>
            <MenuList theme={theme} items={GAME.snacks} />
            <p className="text-sm text-[#9aa9cf]">{t('park.venue.prices')}</p>
          </div>
        </div>
      </section>

      <VenueStrip
        band="bg-venue-amber text-[#1a1300]"
        hours={HOURS.games}
        also={{ href: '/billiards', label: 'park.games.alsoBilliards' }}
      />
    </>
  )
}
