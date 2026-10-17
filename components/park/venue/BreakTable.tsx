'use client'

import { useId, useState } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

// Top-down billiards table. "Break" scatters the rack (two balls drop into
// pockets); "Rack again" sets it back. Pure CSS transitions on SVG groups;
// reduced-motion users get the same states without the travel.
const R = 7
const COLORS: Record<number, string> = {
  1: '#f2c230', 2: '#2456c7', 3: '#d7372d', 4: '#6b3fa0', 5: '#f07f22', 6: '#1f8a4c', 7: '#7d2520', 8: '#111111',
}
const color = (n: number) => COLORS[n > 8 ? n - 8 : n]

// Standard 8-ball rack, apex toward the cue ball, 8 in the centre.
const ROWS = [[1], [9, 2], [10, 8, 3], [11, 4, 12, 5], [13, 6, 14, 7, 15]]
const APEX = { x: 268, y: 110 }

const RACK = ROWS.flatMap((row, i) =>
  row.map((n, j) => ({ n, x: APEX.x + i * R * 1.75, y: APEX.y + (j - (row.length - 1) / 2) * R * 2.02 })),
)

// Hand-placed spread so every break looks the same (and plausible).
const SCATTER: Record<number, { x: number; y: number; sunk?: boolean }> = {
  1: { x: 300, y: 64 }, 2: { x: 228, y: 168 }, 3: { x: 376, y: 26, sunk: true }, 4: { x: 330, y: 150 },
  5: { x: 352, y: 92 }, 6: { x: 262, y: 44 }, 7: { x: 186, y: 76 }, 8: { x: 284, y: 120 },
  9: { x: 150, y: 150 }, 10: { x: 240, y: 92 }, 11: { x: 338, y: 182 }, 12: { x: 200, y: 196, sunk: true },
  13: { x: 120, y: 58 }, 14: { x: 312, y: 104 }, 15: { x: 356, y: 140 },
}
const CUE_RACK = { x: 96, y: 110 }
const CUE_BREAK = { x: 206, y: 128 }

function Ball({ n, x, y, sunk, clip }: { n: number; x: number; y: number; sunk?: boolean; clip: string }) {
  const stripe = n > 8
  return (
    <g
      style={{ transform: `translate(${x}px, ${y}px)`, opacity: sunk ? 0 : 1 }}
      className="transition-[transform,opacity] duration-[1100ms] ease-[cubic-bezier(0.12,0.85,0.25,1)] motion-reduce:transition-none"
    >
      {stripe ? (
        <>
          <circle r={R} fill="#f7f3ea" />
          <rect x={-R} y={-3.2} width={R * 2} height={6.4} fill={color(n)} clipPath={`url(#${clip})`} />
        </>
      ) : (
        <circle r={R} fill={color(n)} />
      )}
      <circle r={2.4} fill="#f7f3ea" opacity={n === 8 || !stripe ? 0.9 : 0} />
      <circle cx={-2.2} cy={-2.6} r={1.6} fill="#fff" opacity={0.55} />
    </g>
  )
}

/** The table drawing on its own: racked, or broken with two balls sunk.
 *  Used by the interactive BreakTable and as the billiards illustration
 *  while the room has no photos. Ids are per instance so several can share a page. */
export function TableSvg({
  broken = false,
  label,
  className = 'w-full max-w-[640px]',
}: {
  broken?: boolean
  label?: string
  className?: string
}) {
  const id = useId().replace(/:/g, '')
  const cue = broken ? CUE_BREAK : CUE_RACK
  return (
  <svg viewBox="0 0 400 220" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} className={className}>
    <defs>
      <clipPath id={`${id}-ball`}>
        <circle r={R} />
      </clipPath>
      <radialGradient id={`${id}-lamp`} cx="50%" cy="45%" r="65%">
        <stop offset="0%" stopColor="#2b7a5c" />
        <stop offset="100%" stopColor="#174a39" />
      </radialGradient>
    </defs>
    {/* Rails and felt */}
    <rect x="0" y="0" width="400" height="220" rx="18" fill="#6e281d" />
    <rect x="8" y="8" width="384" height="204" rx="12" fill="#8a3324" />
    <rect x="22" y="22" width="356" height="176" rx="4" fill={`url(#${id}-lamp)`} />
    {/* Diamonds on the rails */}
    {[100, 150, 250, 300].map((x) => (
      <g key={x}>
        <circle cx={x} cy={15} r={1.8} className="fill-venue-brass" />
        <circle cx={x} cy={205} r={1.8} className="fill-venue-brass" />
      </g>
    ))}
    {/* Head string and foot spot */}
    <line x1="96" y1="26" x2="96" y2="194" stroke="#ffffff" strokeOpacity="0.12" />
    {/* Pockets */}
    {[
      [24, 24], [200, 20], [376, 24], [24, 196], [200, 200], [376, 196],
    ].map(([x, y]) => (
      <circle key={`${x}-${y}`} cx={x} cy={y} r={11} fill="#120a0a" />
    ))}
    {RACK.map(({ n, x, y }) => {
      const s = SCATTER[n]
      return <Ball key={n} clip={`${id}-ball`} n={n} x={broken ? s.x : x} y={broken ? s.y : y} sunk={broken && s.sunk} />
    })}
    <g
      style={{ transform: `translate(${cue.x}px, ${cue.y}px)` }}
      className="transition-transform duration-[700ms] ease-[cubic-bezier(0.2,0.9,0.3,1)] motion-reduce:transition-none"
    >
      <circle r={R} fill="#f7f3ea" />
    </g>
  </svg>
  )
}

export default function BreakTable() {
  const { t } = useLanguage()
  const [broken, setBroken] = useState(false)

  return (
    <div className="flex flex-col items-start gap-5">
      <TableSvg broken={broken} label={t('park.billiards.tableLabel')} />
      <button
        type="button"
        onClick={() => setBroken((b) => !b)}
        className="inline-flex min-h-[48px] items-center rounded-full bg-venue-brass px-7 font-semibold text-[#1f1214] transition-colors hover:bg-[#e8c88a]"
      >
        {broken ? t('park.billiards.rerack') : t('park.billiards.break')}
      </button>
    </div>
  )
}
