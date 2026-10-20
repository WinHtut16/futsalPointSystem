'use client'

import { useEffect, useRef } from 'react'
import { Gamepad2, Globe, Users, X } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { TranslationKey } from '@/lib/i18n'
import type { ShelfTitle } from '@/lib/park/game-board'
import { descriptionFor } from '@/lib/park/game-library'
import { formatAmount } from '@/lib/park/time'
import ViberLink from '../ViberLink'
import { Cover, tubeFor } from './GameCard'

// Detail sheet for one game: a native <dialog> (focus trap, Esc, top layer),
// as in the landing's GalleryViewer. The cover carries view-transition-name
// "game-cover" so, where supported, it grows out of the card that was tapped
// (GameLibrary starts the transition). Bottom sheet on phones, centred panel
// from sm up.
export default function GameDetail({ game, onClose }: { game: ShelfTitle | null; onClose: () => void }) {
  const { t, lang } = useLanguage()
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (game && !d.open) d.showModal()
    if (!game && d.open) d.close()
  }, [game])

  const desc = game ? descriptionFor(game, lang) : null
  const n = (x: number) => formatAmount(x, lang)

  return (
    <dialog
      ref={dialog}
      aria-label={game ? game.title : t('park.lib.details')}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) dialog.current?.close()
      }}
      className="gd m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-[28px] p-0 text-[rgb(var(--arc-text))] sm:m-auto sm:max-w-[760px] sm:rounded-[28px]"
    >
      {game && (
        <div className={`gd-panel ${tubeFor(game)} grid gap-6 p-5 sm:grid-cols-[240px_1fr] sm:gap-8 sm:p-8`}>
          <div className="relative mx-auto w-[min(60vw,240px)] sm:w-full">
            <span className="gl-box relative block aspect-[3/4] overflow-hidden rounded-2xl" style={{ viewTransitionName: 'game-cover' }}>
              <Cover game={game} sizes="(min-width: 640px) 240px, 60vw" className="absolute inset-0" />
            </span>
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <h3 className="arc-num arc-sign-soft text-[28px] leading-tight sm:text-[34px]">{game.title}</h3>
              <button
                type="button"
                onClick={() => dialog.current?.close()}
                aria-label={t('park.lib.close')}
                autoFocus
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <ul className="flex flex-wrap gap-2 text-[13px] font-semibold">
              {game.platforms.map((p) => (
                <li key={p} className={`arc-tag ${p === 'PS5' ? 'tube-cyan' : 'tube-blue'}`}>
                  {p}
                </li>
              ))}
              {game.isNew && <li className="arc-tag tube-cyan">{t('park.games.tagNew')}</li>}
              {game.isPopular && <li className="arc-tag tube-amber">{t('park.games.tagPopular')}</li>}
            </ul>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[15px]">
              <div className="flex items-center gap-2">
                <dt className="sr-only">{t('park.lib.players')}</dt>
                <Users size={17} aria-hidden="true" className="text-[rgb(var(--arc-muted))]" />
                <dd>{game.maxPlayers === 1 ? t('park.games.player1') : t('park.games.playersN', { n: n(game.maxPlayers) })}</dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="sr-only">{t('park.lib.genre')}</dt>
                <Gamepad2 size={17} aria-hidden="true" className="text-[rgb(var(--arc-muted))]" />
                <dd>{t(`park.genre.${game.genre}` as TranslationKey)}</dd>
              </div>
              {game.localCoop && (
                <div className="col-span-2 flex items-center gap-2 text-[rgb(var(--arc-amber))]">
                  <dt className="sr-only">{t('park.lib.coop')}</dt>
                  <Users size={17} aria-hidden="true" />
                  <dd>{t('park.lib.coopLong')}</dd>
                </div>
              )}
              {game.online && (
                <div className="col-span-2 flex items-center gap-2">
                  <dt className="sr-only">{t('park.lib.online')}</dt>
                  <Globe size={17} aria-hidden="true" className="text-[rgb(var(--arc-muted))]" />
                  <dd>{t('park.lib.onlineLong')}</dd>
                </div>
              )}
            </dl>
            <p className="max-w-[52ch] text-[16px] leading-relaxed text-[rgb(var(--arc-muted))]">{desc ?? t('park.lib.noDesc')}</p>
            <div className="mt-auto flex flex-wrap gap-3 pt-1">
              <ViberLink className="arc-btn-primary inline-flex min-h-[48px] items-center rounded-full px-6 font-semibold">
                {t('park.lib.ask')}
              </ViberLink>
            </div>
          </div>
        </div>
      )}
    </dialog>
  )
}
