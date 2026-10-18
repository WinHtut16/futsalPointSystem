'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Users } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { TranslationKey } from '@/lib/i18n'
import type { ShelfTitle } from '@/lib/park/game-board'
import { formatAmount } from '@/lib/park/time'

// "On the shelf": the games staff keep on the game admin's Games screen
// (game.titles). Covers sit like boxes on a lit shelf; games without a cover
// get their title set in the sign face (Latin-first: game names are almost
// always Latin) instead of an empty frame. Titles stay
// in their own name in both languages; genre and labels are translated.
type Filter = 'all' | 'PS4' | 'PS5'

export default function GameShelf({ titles }: { titles: ShelfTitle[] }) {
  const { t, lang } = useLanguage()
  const [filter, setFilter] = useState<Filter>('all')
  const n = (x: number) => formatAmount(x, lang)

  const hasBoth = titles.some((g) => g.platforms.includes('PS4')) && titles.some((g) => g.platforms.includes('PS5'))
  const shown = filter === 'all' ? titles : titles.filter((g) => g.platforms.includes(filter))

  return (
    <section aria-labelledby="games-shelf" className="py-20 md:py-24">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-8 px-4 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="flex max-w-[48ch] flex-col gap-3">
            <h2 id="games-shelf" className="arc-font arc-sign-soft tube-magenta text-[36px] leading-[1.1] md:text-[46px]">
              {t('park.games.shelfTitle')}
            </h2>
            <p className="text-[17px] leading-relaxed text-[rgb(var(--arc-muted))]">{t('park.games.shelfBody')}</p>
          </div>
          {hasBoth && (
            <div role="group" aria-label={t('park.games.shelfFilter')} className="flex gap-2">
              {(['all', 'PS4', 'PS5'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
                  className="arc-chip min-h-[44px] rounded-full px-5 text-[15px] font-semibold"
                >
                  {f === 'all' ? t('park.games.shelfAll') : f}
                </button>
              ))}
            </div>
          )}
        </div>

        <ul className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {shown.map((g) => (
            <li key={g.id} className="flex flex-col gap-2.5">
              <div className="arc-box relative aspect-[3/4] overflow-hidden rounded-xl">
                {g.coverUrl ? (
                  <Image
                    src={g.coverUrl}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 220px, (min-width: 640px) 30vw, 46vw"
                    className="object-cover"
                  />
                ) : (
                  <div aria-hidden="true" className="arc-box-blank flex h-full items-end p-3">
                    <span className="arc-num arc-sign tube-cyan text-[19px] leading-tight [overflow-wrap:anywhere] sm:text-[22px]">{g.title}</span>
                  </div>
                )}
                {(g.isNew || g.isPopular) && (
                  <span className="absolute left-2 top-2 flex flex-wrap gap-1.5">
                    {g.isNew && <span className="arc-tag tube-cyan">{t('park.games.tagNew')}</span>}
                    {g.isPopular && <span className="arc-tag tube-amber">{t('park.games.tagPopular')}</span>}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="text-[15px] font-semibold leading-snug">{g.title}</h3>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[rgb(var(--arc-muted))]">
                  <span className="font-semibold text-[rgb(var(--arc-text))]">{g.platforms.join(' · ')}</span>
                  <span aria-hidden="true">·</span>
                  <span>{t(`park.genre.${g.genre}` as TranslationKey)}</span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1">
                    <Users size={13} aria-hidden="true" />
                    {g.maxPlayers === 1 ? t('park.games.player1') : t('park.games.playersN', { n: n(g.maxPlayers) })}
                  </span>
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
