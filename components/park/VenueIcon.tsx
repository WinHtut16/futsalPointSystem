// Animated venue mark: inline SVG moved by CSS keyframes in park.css (the
// `vi-*` classes). Each icon has a quiet idle loop and a livelier loop while
// `hover` is true; `hover` mirrors the pointer over the surrounding block.
// Reduced-motion visitors get the still drawing. Artwork matches
// docs/park/icon-art/icon-*.svg (the source drawings, 112 x 112).

export type VenueIconKind = 'pool' | 'food' | 'futsal' | 'games' | 'billiards' | 'market'

const INK = '#12302A'

function Pool() {
  return (
    <>
      <circle cx="56" cy="56" r="56" className="fill-[#178490]" />
      <path className="vi-pool-drop" d="M56 30 C52 36 50 39 50 42 a6 6 0 0 0 12 0 C62 39 60 36 56 30 Z" fill="#FFFFFF" />
      {[44, 58, 72].map((y, i) => (
        <path
          key={y}
          className={`vi-pool-wave vi-pool-wave-${i + 1}`}
          d={`M28 ${y} q7 -6 14 0 t14 0 t14 0 t14 0`}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </>
  )
}

function Food() {
  return (
    <>
      <circle cx="56" cy="56" r="56" className="fill-park-sun" />
      <path className="vi-steam vi-steam-1" d="M46 40 c-4 -5 4 -8 0 -14" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <path className="vi-steam vi-steam-2" d="M60 40 c-4 -5 4 -8 0 -14" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <g className="vi-chopsticks" stroke={INK} strokeWidth="4" strokeLinecap="round">
        <path d="M66 22 L84 50" />
        <path d="M74 20 L88 48" />
      </g>
      <path d="M30 52 H82 A26 26 0 0 1 30 52 Z" fill={INK} />
      <path d="M46 78 H66" stroke={INK} strokeWidth="5" strokeLinecap="round" />
      <path d="M28 52 H84" stroke={INK} strokeWidth="5" strokeLinecap="round" />
    </>
  )
}

function Futsal() {
  return (
    <>
      <circle cx="56" cy="56" r="56" className="fill-venue-futsal" />
      <ellipse className="vi-shadow" cx="56" cy="82" rx="16" ry="4" fill="#000000" opacity="0.25" />
      <g className="vi-ball-bounce">
        <g className="vi-ball-spin">
          <circle cx="56" cy="54" r="22" fill="#FFFFFF" />
          <path d="M56 45 L64 51 L61 61 L51 61 L48 51 Z" fill={INK} />
          <path
            d="M56 45 V34 M64 51 L75 47 M61 61 L68 71 M51 61 L44 71 M48 51 L37 47"
            stroke={INK}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </g>
      </g>
    </>
  )
}

function Games() {
  return (
    <>
      <circle cx="56" cy="56" r="56" className="fill-venue-game" />
      <g className="vi-pad">
        <path
          d="M36 42 H76 C86 42 92 50 94 62 C96 74 90 80 84 78 C78 76 74 68 68 68 H44 C38 68 34 76 28 78 C22 80 16 74 18 62 C20 50 26 42 36 42 Z"
          fill="#FFFFFF"
        />
        <g className="vi-dpad" fill={INK}>
          <rect x="30" y="53" width="16" height="6" rx="2" />
          <rect x="35" y="48" width="6" height="16" rx="2" />
        </g>
        {[
          [78, 49],
          [85, 56],
          [78, 63],
          [71, 56],
        ].map(([cx, cy], i) => (
          <circle key={i} className={`vi-btn vi-btn-${i + 1}`} cx={cx} cy={cy} r="3.6" fill="#F2B84B" />
        ))}
      </g>
    </>
  )
}

function Billiards() {
  return (
    <>
      <circle cx="56" cy="56" r="56" className="fill-venue-billiards" />
      <g className="vi-eight">
        <circle cx="76" cy="58" r="11" fill="#111111" />
        <circle cx="76" cy="58" r="4.5" fill="#F7F3EA" />
      </g>
      <circle className="vi-cueball" cx="50" cy="58" r="11" fill="#F7F3EA" />
      <g className="vi-cue" strokeWidth="5" strokeLinecap="round">
        <path d="M14 72 L34 63" stroke="#F6ECE6" />
        <path d="M34 63 L38 61.2" stroke="#D9B26A" />
      </g>
    </>
  )
}

function Market() {
  return (
    <>
      <circle cx="56" cy="56" r="56" className="fill-park-sun" />
      <path d="M24 30 Q56 42 88 30" fill="none" stroke={INK} strokeWidth="2" />
      {[
        [36, 34],
        [56, 37],
        [76, 34],
      ].map(([cx, cy], i) => (
        <circle key={i} className={`vi-light vi-light-${i + 1}`} cx={cx} cy={cy} r="3.5" fill="#FFFFFF" />
      ))}
      <g className="vi-awning" fill={INK}>
        <path d="M28 46 H84 L80 56 H32 Z" />
        <path d="M32 56 q4 6 8 0 q4 6 8 0 q4 6 8 0 q4 6 8 0 q4 6 8 0 q4 6 8 0" />
      </g>
      <path d="M34 66 H78 V82 H34 Z" fill={INK} />
      <path d="M48 62 H64 V68 H48 Z" fill="#F6ECE6" />
      <path className="vi-pot-steam" d="M56 60 c-3 -3 3 -5 0 -8" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
    </>
  )
}

const ART: Record<VenueIconKind, () => React.JSX.Element> = {
  pool: Pool,
  food: Food,
  futsal: Futsal,
  games: Games,
  billiards: Billiards,
  market: Market,
}

// Decorative: the venue name sits next to it in text.
export default function VenueIcon({ kind, hover = false, size = 56 }: { kind: VenueIconKind; hover?: boolean; size?: number }) {
  const Art = ART[kind]
  return (
    <svg
      viewBox="0 0 112 112"
      width={size}
      height={size}
      className={`vi shrink-0${hover ? ' vi-hover' : ''}`}
      aria-hidden="true"
      focusable="false"
    >
      <Art />
    </svg>
  )
}
