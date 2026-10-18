'use client'

import { useState } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { GAME } from '@/lib/park/content'
import { formatAmount } from '@/lib/park/time'

// The real room layout from the game shop system: TV 1-7 PS4, TV 8-9 PS5,
// one VIP room. Tapping a seat answers "what is it and what does it cost".
type Seat = { id: string; n?: number; kind: 'ps4' | 'ps5' | 'vip' }

const SEATS: Seat[] = [
  ...GAME.ps4Screens.map((n) => ({ id: `tv${n}`, n, kind: 'ps4' as const })),
  ...GAME.ps5Screens.map((n) => ({ id: `tv${n}`, n, kind: 'ps5' as const })),
]

// Each TV is a lit outline in its console's tube colour (arc-seat, park.css).
const TUBE = {
  ps4: 'tube-blue',
  ps5: 'tube-cyan',
  vip: 'tube-amber',
}

export default function GameFloor() {
  const { t, lang } = useLanguage()
  const [picked, setPicked] = useState<Seat | null>(null)

  const label = (s: Seat) => (s.kind === 'vip' ? t('park.games.vip') : t('park.games.screen', { n: s.n ?? 0 }))
  const price = (s: Seat) => GAME.rates[s.kind]
  const consoleName = (s: Seat) => (s.kind === 'ps4' ? t('park.games.ps4') : t('park.games.ps5'))

  const seatBtn = (s: Seat, extra = '') => {
    const on = picked?.id === s.id
    return (
      <button
        key={s.id}
        type="button"
        aria-pressed={on}
        aria-label={`${label(s)}, ${consoleName(s)}`}
        onClick={() => setPicked(on ? null : s)}
        className={`arc-seat arc-num flex items-center justify-center rounded-xl ${TUBE[s.kind]} ${extra}`}
      >
        {s.kind === 'vip' ? t('park.games.vip') : s.n}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label={t('park.games.floorLabel')} className="arc-floor flex flex-col gap-3 rounded-3xl p-4 sm:p-5">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {SEATS.map((s) => seatBtn(s, 'aspect-[4/3] text-lg'))}
        </div>
        {seatBtn({ id: 'vip', kind: 'vip' }, 'h-24 text-xl')}
      </div>
      <p aria-live="polite" className="min-h-[3em] text-[rgb(var(--arc-muted))]">
        {picked
          ? t('park.games.selected', {
              seat: label(picked),
              console: consoleName(picked),
              price: formatAmount(price(picked), lang),
            })
          : t('park.games.floorHint')}
      </p>
    </div>
  )
}
