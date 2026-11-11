'use client'

import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { TranslationKey } from '@/lib/i18n'
import { GAME } from '@/lib/park/content'
import type { BoardStation, GameBoard, StationStatus } from '@/lib/park/game-board'
import { formatAmount } from '@/lib/park/time'

// Mini cinema: TVs the admin marks as tier CINEMA, for watching films and
// shows on a big screen. Own block under the game floor so the "free now"
// count above stays about game screens. Live status uses the same lit-tube
// seat styles as GameFloor (magenta tube). Channels are one shared list
// (content.ts), shown as text. No live board: heading and channels only.
const STATE_CLASS: Record<StationStatus, string> = {
  free: '',
  busy: 'is-busy',
  reserved: 'is-reserved',
  maintenance: 'is-off',
}

export default function CinemaRow({ board }: { board: GameBoard | null }) {
  const { t, lang } = useLanguage()
  const n = (x: number) => formatAmount(x, lang)
  // `?? []`: a board cached from before this block existed has no `cinema`.
  const tvs: BoardStation[] = board?.cinema ?? []
  // A live board with no cinema TVs: the room is not set up, say nothing.
  if (board && tvs.length === 0) return null

  const statusText = (st: StationStatus) => t(`park.games.status.${st}` as TranslationKey)
  const label = (s: BoardStation, i: number) => t('park.games.cinemaTv', { n: n(s.n ?? i + 1) })
  const rate = board?.rates?.cinema ?? null
  const points = board?.points?.cinema ?? 0

  return (
    <div className="flex flex-col gap-4" role="group" aria-labelledby="games-cinema">
      <div className="flex flex-col gap-1.5">
        <h3 id="games-cinema" className="arc-font arc-sign-soft tube-magenta text-[26px] leading-tight md:text-[30px]">
          {t('park.games.cinemaTitle')}
        </h3>
        <p className="max-w-[52ch] text-[16px] leading-relaxed text-[rgb(var(--arc-muted))]">
          {t('park.games.cinemaBody')}
        </p>
      </div>

      {tvs.length > 0 && (
        <div className="arc-floor grid grid-cols-2 gap-3 rounded-3xl p-4 sm:p-5">
          {tvs.map((s, i) => (
            <div
              key={s.id}
              aria-label={`${label(s, i)}, ${statusText(s.status)}`}
              className={`arc-seat arc-num tube-magenta relative flex h-24 flex-col items-center justify-center gap-0.5 rounded-xl text-xl ${STATE_CLASS[s.status]}`}
            >
              <span aria-hidden="true" className={`arc-dot is-${s.status} absolute right-2 top-2`} />
              <span aria-hidden="true">{label(s, i)}</span>
              {s.status !== 'free' && (
                <span aria-hidden="true" className="arc-seat-state text-[11px] font-semibold leading-tight">
                  {statusText(s.status)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-[rgb(var(--arc-muted))]">{t('park.games.cinemaChannels')}</p>
        <ul className="flex flex-wrap gap-2" aria-label={t('park.games.cinemaChannels')}>
          {GAME.cinemaChannels.map((c) => (
            <li key={c} className="arc-tag tube-magenta">
              {c}
            </li>
          ))}
        </ul>
      </div>

      {(rate !== null || points > 0) && (
        <p className="text-[15px] text-[rgb(var(--arc-muted))]">
          {[
            rate !== null ? t('park.games.cinemaRate', { price: n(rate) }) : null,
            points > 0 ? t('park.games.pointsPerHour', { p: n(points) }) : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}
    </div>
  )
}
