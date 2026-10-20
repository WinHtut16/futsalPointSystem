'use client'

import Image from 'next/image'
import { Users } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { ShelfTitle } from '@/lib/park/game-board'
import { formatAmount } from '@/lib/park/time'

// One game in the library: its box on the lit shelf (the gl-* classes in
// park.css). The edge glows in its console's tube colour (PS5 cyan, PS4
// violet-blue). Games without a cover get their title set in the sign face.
export const tubeFor = (g: ShelfTitle) => (g.platforms.includes('PS5') ? 'tube-cyan' : 'tube-blue')

export function Cover({ game, sizes, className = '' }: { game: ShelfTitle; sizes: string; className?: string }) {
  return (
    <span className={`gl-cover ${className}`}>
      {game.coverUrl ? (
        <Image src={game.coverUrl} alt="" fill sizes={sizes} className="object-cover" />
      ) : (
        <span aria-hidden="true" className="gl-cover-blank">
          <span className={`arc-num arc-sign ${tubeFor(game)} text-[clamp(17px,2.2vw,22px)] leading-tight [overflow-wrap:anywhere]`}>
            {game.title}
          </span>
        </span>
      )}
    </span>
  )
}

export default function GameCard({
  game,
  onOpen,
  sizes = '(min-width: 1024px) 190px, 42vw',
}: {
  game: ShelfTitle
  onOpen: (g: ShelfTitle, from: HTMLElement | null) => void
  sizes?: string
}) {
  const { t, lang } = useLanguage()
  return (
    <button
      type="button"
      onClick={(e) => onOpen(game, e.currentTarget.querySelector('.gl-cover'))}
      className={`gl-card ${tubeFor(game)} group flex w-full flex-col gap-2.5 text-left`}
      aria-label={t('park.lib.open', { title: game.title })}
    >
      <span className="gl-box relative block aspect-[3/4] w-full overflow-hidden rounded-xl">
        <Cover game={game} sizes={sizes} className="absolute inset-0" />
        {(game.isNew || game.localCoop) && (
          <span className="absolute left-2 top-2 flex flex-wrap gap-1.5">
            {game.isNew && <span className="arc-tag tube-cyan">{t('park.games.tagNew')}</span>}
            {game.localCoop && <span className="arc-tag tube-amber">{t('park.lib.coop')}</span>}
          </span>
        )}
      </span>
      <span className="flex flex-col gap-1">
        <span className="line-clamp-2 text-[15px] font-semibold leading-snug">{game.title}</span>
        <span className="flex flex-wrap items-center gap-x-2 text-[13px] text-[rgb(var(--arc-muted))]">
          <span className="font-semibold text-[rgb(var(--arc-text))]">{game.platforms.join(' · ')}</span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1">
            <Users size={13} aria-hidden="true" />
            {formatAmount(game.maxPlayers, lang)}
          </span>
        </span>
      </span>
    </button>
  )
}
