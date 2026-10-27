'use client'

import { useEffect, useRef } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { POOL } from '@/lib/park/content'
import { formatAmount } from '@/lib/park/time'
import { armReveal } from '../../Reveal'

// Side view of the pool drawn to scale in depth: the floor slopes from the
// shallow end to the deep end, with a child and an adult standing in it so a
// parent can see at a glance how deep the water comes. Depth numbers sit on
// the deck the way they are painted at a real pool.

const W = 640
const RIM = 100 // water line and deck height
const LEFT = 40
const RIGHT = 600
const FT = 30 // px per foot of depth

const shallowY = RIM + POOL.depthFt.shallow * FT
const deepY = RIM + POOL.depthFt.deep * FT
const floorAt = (x: number) => shallowY + ((x - LEFT) / (RIGHT - LEFT)) * (deepY - shallowY)

// A swimmer pictogram standing on the floor at `x`, `heightFt` tall.
function Swimmer({ x, heightFt, scale, className }: { x: number; heightFt: number; scale: number; className: string }) {
  const foot = floorAt(x)
  const top = foot - heightFt * FT
  const head = 11 * scale
  const bodyW = 20 * scale
  return (
    <g fill="#ffffff" className={className}>
      <circle cx={x} cy={top + head} r={head} />
      <rect x={x - bodyW / 2} y={top + head * 2 + 2} width={bodyW} height={foot - (top + head * 2 + 2)} rx={bodyW / 2} />
    </g>
  )
}

// Sine wave wider than the pool so the scroll loops without a seam.
const wave = (() => {
  let d = `M0 ${RIM}`
  for (let x = 0; x < W + 80; x += 40) d += ` q10 -4 20 0 q10 4 20 0`
  return `${d} V${deepY + 10} H0 Z`
})()

export default function PoolDepth({ className = '' }: { className?: string }) {
  const { t, lang } = useLanguage()
  const ref = useRef<SVGSVGElement>(null)
  // Water fills the basin the first time the drawing scrolls into view.
  useEffect(() => (ref.current ? armReveal(ref.current, 0.35) : undefined), [])
  const n = (v: number) => formatAmount(v, lang)
  const basin = `M${LEFT} ${RIM} V${shallowY} L${RIGHT} ${deepY} V${RIM} Z`

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${W} 300`}
      role="img"
      aria-label={t('park.pool.diagramLabel', {
        shallow: n(POOL.depthFt.shallow),
        deep: n(POOL.depthFt.deep),
        length: n(POOL.sizeFt.length),
      })}
      className={`pool-depth h-auto w-full ${className}`}
    >
      <defs>
        <linearGradient id="pool-depth-water" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#7d9fd4" />
          <stop offset="0.55" stopColor="#4a70b0" />
          <stop offset="1" stopColor="#2b4c86" />
        </linearGradient>
        <clipPath id="pool-depth-basin">
          <path d={basin} />
        </clipPath>
      </defs>

      {/* Swimmers first, so the water drawn over them tints what is submerged. */}
      <Swimmer x={170} heightFt={3.2} scale={1.1} className="pool-bob" />
      <Swimmer x={455} heightFt={5.6} scale={1.3} className="pool-bob pool-bob-2" />

      <g clipPath="url(#pool-depth-basin)">
        <g className="pool-fill">
        <g className="pool-wave">
          <path d={wave} fill="url(#pool-depth-water)" opacity="0.78" />
        </g>
        </g>
      </g>

      {/* Tiled basin and deck. */}
      <path d={`M${LEFT} ${RIM} V${shallowY} L${RIGHT} ${deepY} V${RIM}`} fill="none" stroke="#f5f5f3" strokeWidth="5" strokeLinejoin="round" />
      <path d={`M0 ${RIM} H${LEFT} M${RIGHT} ${RIM} H${W}`} stroke="#f5f5f3" strokeWidth="5" strokeLinecap="round" />

      {/* Depth markings painted on the deck. */}
      <g className="pool-mark" fill="#ffcb47" fontSize="26" fontWeight="700">
        <text x={LEFT + 8} y={RIM - 14}>{t('park.pool.ft', { n: n(POOL.depthFt.shallow) })}</text>
        <text x={RIGHT - 8} y={RIM - 14} textAnchor="end">{t('park.pool.ft', { n: n(POOL.depthFt.deep) })}</text>
      </g>

      {/* Ends and length. */}
      <g fill="#c9d6ea" fontSize="22">
        <text x={LEFT} y={deepY + 38}>{t('park.pool.shallowEnd')}</text>
        <text x={RIGHT} y={deepY + 38} textAnchor="end">{t('park.pool.deepEnd')}</text>
      </g>
      <g stroke="#c9d6ea" strokeWidth="1.5">
        <path d={`M${LEFT} 284 H${W / 2 - 56} M${W / 2 + 56} 284 H${RIGHT}`} />
        <path d={`M${LEFT} 276 V292 M${RIGHT} 276 V292`} />
      </g>
      <text x={W / 2} y={292} textAnchor="middle" fill="#ffffff" fontSize="22" fontWeight="700">
        {t('park.pool.ft', { n: n(POOL.sizeFt.length) })}
      </text>
    </svg>
  )
}
