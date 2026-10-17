'use client'

import Image from 'next/image'
import { Waves, UtensilsCrossed, Volleyball, Gamepad2, CircleDot, Trees, Store } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { PHOTOS, type PhotoKey, type PhotoTone, type PhotoIcon } from '@/lib/park/photos'

const TONE: Record<PhotoTone, string> = {
  pool: 'bg-park-pool text-white/35',
  sun: 'bg-park-sun text-park-ink/20',
  jungle: 'bg-park-jungle text-white/25',
  game: 'bg-venue-game text-white/30',
  billiards: 'bg-venue-billiards text-white/25',
  mist: 'bg-park-line text-park-jungle/25',
  night: 'bg-park-night text-white/25',
}

const ICON: Record<PhotoIcon, typeof Waves> = {
  waves: Waves,
  utensils: UtensilsCrossed,
  ball: Volleyball,
  gamepad: Gamepad2,
  billiards: CircleDot,
  trees: Trees,
  store: Store,
}

// A photo slot. `className` sets shape and size (aspect ratio, radius); the
// image fills it. Missing files render a tinted block, never a broken image.
export default function ParkPhoto({
  photo,
  className = '',
  sizes,
  priority = false,
}: {
  photo: PhotoKey
  className?: string
  sizes: string
  priority?: boolean
}) {
  const { t } = useLanguage()
  const p = PHOTOS[photo]
  const alt = t(p.alt)
  // Callers may position the slot themselves (absolute overlays).
  const pos = /\b(absolute|fixed)\b/.test(className) ? '' : 'relative'

  if (p.ready) {
    return (
      <div className={`${pos} overflow-hidden ${className}`}>
        <Image src={p.file} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />
      </div>
    )
  }

  const Icon = ICON[p.icon]
  return (
    <div role="img" aria-label={alt} className={`${pos} flex items-center justify-center overflow-hidden ${TONE[p.tone]} ${className}`}>
      <Icon aria-hidden="true" strokeWidth={1.25} className="h-1/4 w-1/4 max-h-24 max-w-24" />
      {process.env.NODE_ENV === 'development' && (
        <span className="absolute bottom-2 left-2 rounded bg-white/85 px-2 py-0.5 font-mono text-[11px] text-park-ink">
          {p.file}
        </span>
      )}
    </div>
  )
}
