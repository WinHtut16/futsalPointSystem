'use client'

import { useLanguage } from '@/lib/i18n/LanguageContext'
import { GAME, HOURS, PARK } from '@/lib/park/content'
import { formatAmount } from '@/lib/park/time'
import type { GameBoard, ShelfTitle } from '@/lib/park/game-board'
import GameFloor from './GameFloor'
import GameLibrary from './GameLibrary'
import { COVER_WALL_MIN, CoverWall, LivePill, LiveStrip } from './GamesHero'
import { useGameBoard } from './useGameBoard'
import ParkPhoto from '../ParkPhoto'
import { MenuList, PriceRows, VenueHero, VenueStrip, type Theme } from './VenueParts'

// The room at night: neon-tube signs over LED-lit screens (the .arcade and
// arc-* classes in park.css; the page wrapper in app/(park)/games/page.tsx
// sets .arcade). Amber stays the shop's own brand colour.
const theme: Theme = {
  ground: 'text-[rgb(var(--arc-text))]',
  panel: 'arc-panel',
  muted: 'text-[rgb(var(--arc-muted))]',
  accent: 'arc-led',
  rule: 'divide-white/10 border-white/10',
  primaryBtn: 'arc-btn-primary',
  secondaryBtn: 'arc-btn-ghost',
}

const h2 = 'arc-font arc-sign-soft text-[36px] leading-[1.1] md:text-[46px]'

export default function GamesContent({ initialBoard, shelf }: { initialBoard: GameBoard | null; shelf: ShelfTitle[] }) {
  const { t, lang } = useLanguage()
  const n = (x: number) => formatAmount(x, lang)
  // Live TVs and rates from the game shop's admin; static content.ts values
  // stand in whenever the board is unavailable or stale.
  const { board, now } = useGameBoard(initialBoard)
  const rates = board?.rates ?? null
  const price = {
    ps4: rates?.ps4 ?? GAME.rates.ps4,
    ps5: rates?.ps5 ?? GAME.rates.ps5,
    vip: rates?.vip ?? GAME.rates.vip,
  }
  const rules = {
    min: rates?.minMinutes ?? GAME.minimumMinutes,
    block: rates?.stepMinutes ?? GAME.blockMinutes,
    grace: rates?.graceMinutes ?? GAME.graceMinutes,
  }

  // The cover wall takes over the hero once the staff's list has enough
  // covers to fill it; until then the room photo switches on like a screen.
  const covers = shelf.filter((g) => g.coverUrl)

  return (
    <>
      {covers.length >= COVER_WALL_MIN ? (
        <CoverWall covers={covers} board={board} />
      ) : (
        <VenueHero
          theme={theme}
          title="park.games.title"
          lead="park.games.lead"
          photo="gameRoom"
          badge={<LivePill board={board} />}
          primary={{ href: '#games-library', label: 'park.games.ctaBrowse' }}
          secondary={{ href: '#games-floor', label: 'park.games.ctaFree' }}
          glow="arc-screen arc-crt"
          sectionClass="arc-hero"
          titleClass="arc-font arc-sign tube-cyan arc-flicker"
        />
      )}
      <LiveStrip board={board} price={price} />

      <section aria-labelledby="games-floor" className={`${theme.panel} py-20 md:py-24`}>
        <div className="mx-auto grid max-w-[1200px] items-start gap-10 px-4 md:px-8 lg:grid-cols-[5fr_7fr] lg:gap-14">
          <div className="flex flex-col gap-4">
            <h2 id="games-floor" className={`${h2} tube-cyan scroll-mt-32`}>
              {t('park.games.floorTitle')}
            </h2>
            <p className={`max-w-[42ch] text-[17px] leading-relaxed ${theme.muted}`}>{t('park.games.floorBody')}</p>
            <ul className="flex flex-wrap gap-5 pt-1 text-[15px]" aria-hidden="true">
              <li className="flex items-center gap-2"><span className="arc-swatch tube-blue h-3.5 w-3.5 rounded" />{t('park.games.ps4')}</li>
              <li className="flex items-center gap-2"><span className="arc-swatch tube-cyan h-3.5 w-3.5 rounded" />{t('park.games.ps5')}</li>
              <li className="flex items-center gap-2"><span className="arc-swatch tube-amber h-3.5 w-3.5 rounded" />{t('park.games.vip')}</li>
            </ul>
          </div>
          <GameFloor board={board} rates={rates} now={now} />
        </div>
      </section>

      <GameLibrary titles={shelf} />

      <section aria-labelledby="games-vip" className={`${theme.ground} pt-20 md:pt-24`}>
        <div className="mx-auto grid max-w-[1200px] items-end gap-6 px-4 md:px-8 lg:grid-cols-[7fr_5fr] lg:gap-10">
          <ParkPhoto
            photo="gameVip"
            sizes="(min-width: 1024px) 680px, 92vw"
            className="arc-screen tube-amber aspect-[4/3] rounded-[28px]"
          />
          <div className="flex flex-col gap-5">
            <ParkPhoto photo="gameControllers" sizes="(min-width: 1024px) 460px, 92vw" className="arc-screen tube-cyan hidden aspect-[4/3] rounded-[22px] lg:block" />
            <h2 id="games-vip" className={`${h2} tube-amber`}>
              {t('park.games.vipTitle')}
            </h2>
            <p className={`max-w-[40ch] text-[17px] leading-relaxed ${theme.muted}`}>{t('park.games.vipBody')}</p>
            <p className="arc-led text-lg font-semibold">{t('park.venue.perHour', { price: n(price.vip) })}</p>
          </div>
        </div>
      </section>

      <section id="rates" className={`${theme.ground} scroll-mt-32 py-20 md:py-24`}>
        <div className="mx-auto grid max-w-[1200px] items-start gap-14 px-4 md:px-8 lg:grid-cols-2">
          <div className="flex flex-col gap-5">
            <h2 className={`${h2} tube-magenta`}>{t('park.games.ratesTitle')}</h2>
            <PriceRows
              theme={theme}
              rows={[
                ['park.games.ratePs4', price.ps4],
                ['park.games.ratePs5', price.ps5],
                ['park.games.rateVip', price.vip],
              ]}
            />
            <p className={`text-[15px] leading-relaxed ${theme.muted}`}>
              {t('park.games.rules', { min: n(rules.min), block: n(rules.block), grace: n(rules.grace) })}
            </p>
          </div>
          <div className="flex flex-col gap-5">
            <h2 className={`${h2} tube-blue`}>{t('park.games.snacksTitle')}</h2>
            <MenuList theme={theme} items={GAME.snacks} />
            <p className={`text-sm ${theme.muted}`}>{t('park.venue.prices')}</p>
          </div>
        </div>
      </section>

      <VenueStrip
        band="arc-marquee"
        hours={HOURS.games}
        also={{ href: '/billiards', label: 'park.games.alsoBilliards' }}
      />
    </>
  )
}
