'use client'

import { Waves, UtensilsCrossed, Volleyball, Gamepad2, CircleDot } from 'lucide-react'
import type { RiveKey } from '@/lib/park/rive'
import RiveSlot from './RiveSlot'

export type VenueIconKind = 'pool' | 'food' | 'futsal' | 'games' | 'billiards'

const SPEC: Record<VenueIconKind, { anim: RiveKey; Icon: typeof Waves; chip: string }> = {
  pool: { anim: 'iconPool', Icon: Waves, chip: 'bg-park-pool text-white' },
  food: { anim: 'iconFood', Icon: UtensilsCrossed, chip: 'bg-park-sun text-park-ink' },
  futsal: { anim: 'iconFutsal', Icon: Volleyball, chip: 'bg-venue-futsal text-white' },
  games: { anim: 'iconGames', Icon: Gamepad2, chip: 'bg-venue-game text-white' },
  billiards: { anim: 'iconBilliards', Icon: CircleDot, chip: 'bg-venue-billiards text-white' },
}

// Decorative venue mark. `hover` mirrors the pointer over the surrounding
// block so the Rive icon can react (bounce, steam, ripple).
export default function VenueIcon({ kind, hover = false, size = 56 }: { kind: VenueIconKind; hover?: boolean; size?: number }) {
  const { anim, Icon, chip } = SPEC[kind]
  return (
    <RiveSlot
      anim={anim}
      className="shrink-0"
      style={{ width: size, height: size }}
      values={{ booleans: { hover } }}
      fallback={
        <span className={`flex h-full w-full items-center justify-center rounded-full ${chip}`}>
          <Icon aria-hidden="true" size={size * 0.46} strokeWidth={1.75} />
        </span>
      }
    />
  )
}
