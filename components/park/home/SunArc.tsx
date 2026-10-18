// Sun (or moon) on a horizon arc for a given hour, drawn at 128 x 80 and
// scaled by its box. The sun rides a pivot at the arc's centre, so moving it is
// one rotation that CSS eases (`sa-*` classes in park.css). Before the hour is
// known (server render) only the arc and horizon show.

const RISE = 6
const SET = 18
const STARS = [
  [30, 30],
  [48, 14],
  [84, 18],
  [100, 34],
  [70, 40],
]

export default function SunArc({
  hour,
  open,
  className,
  tone = 'light',
  scrub = false,
}: {
  hour: number | null
  open: boolean
  className?: string
  /** 'dark' when drawn on a night ground: moon, stars and horizon turn light. */
  tone?: 'light' | 'dark'
  /** Follows scroll (DaySky): a short glide instead of the slow clock ease. */
  scrub?: boolean
}) {
  const nightFill = tone === 'dark' ? 'fill-[#eaf0f7]' : 'fill-park-dusk'
  const horizon = !open ? 'stroke-park-ink-soft/50' : tone === 'dark' ? 'stroke-park-sun/70' : 'stroke-park-jungle'
  const known = hour !== null
  const day = known && hour >= RISE && hour < SET
  const t = known ? Math.min(Math.max((hour - RISE) / (SET - RISE), 0), 1) : 0
  return (
    <svg viewBox="0 0 128 80" overflow="visible" className={className} aria-hidden="true" focusable="false">
      <g className="sa-night" style={{ opacity: known && !day ? 1 : 0 }}>
        {STARS.map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} className={`sa-star ${nightFill}`} cx={cx} cy={cy} r="1.8" />
        ))}
        <path d="M68 20 a14 14 0 1 0 12 22 a11 11 0 1 1 -12 -22 z" className={nightFill} />
      </g>
      <path
        d="M12 68 A52 52 0 0 1 116 68"
        fill="none"
        className="stroke-park-line"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="6 8"
      />
      <g
        className={`sa-sun${scrub ? ' sa-scrub' : ''}`}
        style={{ transform: `rotate(${t * 180}deg)`, transformOrigin: '64px 68px', opacity: day ? 1 : 0 }}
      >
        <circle className="sa-glow fill-park-sun" cx="12" cy="68" r="20" opacity="0.35" />
        <circle className="fill-park-sun" cx="12" cy="68" r="13" />
      </g>
      <path
        d="M4 68 H124"
        className={`sa-horizon ${horizon}`}
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  )
}
