'use client'

import { useState } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { TranslationKey } from '@/lib/i18n'
import { GAME } from '@/lib/park/content'
import type { BoardRates, BoardStation, GameBoard, StationStatus } from '@/lib/park/game-board'
import { formatAmount } from '@/lib/park/time'

// The game room floor plan. With a live board (game.stations via
// /api/park/game-board) every TV shows its console and whether it is free,
// in use, reserved or switched off, straight from the counter. Without one
// (database unreachable, or the board has gone stale) it falls back to the
// static plan in lib/park/content.ts and shows no availability.
type Kind = 'ps4' | 'ps5' | 'vip'
type Seat = { id: string; n: number | null; kind: Kind; status: StationStatus | null }

const TUBE: Record<Kind, string> = { ps4: 'tube-blue', ps5: 'tube-cyan', vip: 'tube-amber' }
const STATE_CLASS: Record<StationStatus, string> = {
  free: '',
  busy: 'is-busy',
  reserved: 'is-reserved',
  maintenance: 'is-off',
}

const STATIC_SEATS: Seat[] = [
  ...GAME.ps4Screens.map((n) => ({ id: `tv${n}`, n, kind: 'ps4' as const, status: null })),
  ...GAME.ps5Screens.map((n) => ({ id: `tv${n}`, n, kind: 'ps5' as const, status: null })),
  { id: 'vip', n: null, kind: 'vip', status: null },
]

const toSeat = (s: BoardStation): Seat => ({ id: s.id, n: s.n, kind: s.tier.toLowerCase() as Kind, status: s.status })

export default function GameFloor({ board, rates, now }: { board: GameBoard | null; rates: BoardRates | null; now: number }) {
  const { t, lang } = useLanguage()
  const [pickedId, setPickedId] = useState<string | null>(null)
  const n = (x: number) => formatAmount(x, lang)

  const seats = board ? board.stations.map(toSeat) : STATIC_SEATS
  const screens = seats.filter((s) => s.kind !== 'vip')
  const vip = seats.find((s) => s.kind === 'vip')
  const picked = seats.find((s) => s.id === pickedId) ?? null

  const rate = (k: Kind) => (rates ? rates[k] : GAME.rates[k])
  const label = (s: Seat) => (s.kind === 'vip' ? t('park.games.vip') : t('park.games.screen', { n: n(s.n ?? 0) }))
  const consoleName = (s: Seat) => (s.kind === 'ps4' ? t('park.games.ps4') : t('park.games.ps5'))
  const statusText = (st: StationStatus) => t(`park.games.status.${st}` as TranslationKey)

  const seatBtn = (s: Seat, extra = '', order = 0) => {
    const on = picked?.id === s.id
    const name = `${label(s)}, ${consoleName(s)}${s.status ? `, ${statusText(s.status)}` : ''}`
    return (
      <button
        key={s.id}
        style={{ ['--i' as string]: order }}
        type="button"
        aria-pressed={on}
        aria-label={name}
        onClick={() => setPickedId(on ? null : s.id)}
        className={`arc-seat arc-num relative flex flex-col items-center justify-center gap-0.5 rounded-xl ${TUBE[s.kind]} ${
          s.status ? STATE_CLASS[s.status] : ''
        } ${extra}`}
      >
        {s.status && <span aria-hidden="true" className={`arc-dot is-${s.status} absolute right-2 top-2`} />}
        <span>{s.kind === 'vip' ? t('park.games.vip') : n(s.n ?? 0)}</span>
        {s.status && s.status !== 'free' && (
          <span aria-hidden="true" className="arc-seat-state text-[11px] font-semibold leading-tight">
            {statusText(s.status)}
          </span>
        )}
      </button>
    )
  }

  const free = seats.filter((s) => s.status === 'free').length
  const ageMin = board ? Math.max(0, Math.floor((now - Date.parse(board.at)) / 60_000)) : 0

  return (
    <div className="flex flex-col gap-4">
      {board && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1" aria-live="polite">
          <p className="flex items-center gap-2 font-semibold">
            <span aria-hidden="true" className="arc-dot is-free arc-live" />
            {t('park.games.freeNow', { free: n(free), total: n(seats.length) })}
          </p>
          <p className="text-sm text-[rgb(var(--arc-muted))]">
            {t('park.games.live')} ·{' '}
            {ageMin < 1 ? t('park.games.updatedNow') : t('park.games.updatedAgo', { n: n(ageMin) })}
          </p>
        </div>
      )}
      <div
        role="group"
        aria-label={t('park.games.floorLabel')}
        data-boot
        className="arc-floor flex flex-col gap-3 rounded-3xl p-4 sm:p-5"
      >
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">{screens.map((s, i) => seatBtn(s, 'aspect-[4/3] text-2xl', i))}</div>
        {vip && seatBtn(vip, 'h-24 text-xl', screens.length)}
      </div>
      {board && (
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-[rgb(var(--arc-muted))]" aria-hidden="true">
          {(['free', 'busy', 'reserved', 'maintenance'] as const).map((st) => (
            <li key={st} className="flex items-center gap-2">
              <span className={`arc-dot is-${st}`} />
              {statusText(st)}
            </li>
          ))}
        </ul>
      )}
      <p aria-live="polite" className="min-h-[3em] text-[rgb(var(--arc-muted))]">
        {picked
          ? t('park.games.selected', { seat: label(picked), console: consoleName(picked), price: n(rate(picked.kind)) }) +
            (picked.status ? ` · ${statusText(picked.status)}` : '')
          : t('park.games.floorHint')}
      </p>
    </div>
  )
}
