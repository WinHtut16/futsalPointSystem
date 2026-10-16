'use client'

import { useEffect, useState } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { HOURS } from '@/lib/park/content'
import { formatHour, isOpenAt, myanmarHourNow } from '@/lib/park/time'

// Sun (or moon) on a horizon arc for the current Myanmar time, plus what is
// open. The futsal court is the only venue with confirmed hours today; the
// line grows as the client confirms the others in lib/park/content.ts.
// Phase 4 swaps the SVG for the `sun-arc` Rive file; this stays as fallback.
const RISE = 6
const SET = 18

function sunPoint(hour: number) {
  // Map daylight hours onto a half circle (left horizon to right horizon).
  const t = Math.min(Math.max((hour - RISE) / (SET - RISE), 0), 1)
  const angle = Math.PI * (1 - t)
  return { x: 32 + 26 * Math.cos(angle), y: 34 - 26 * Math.sin(angle) }
}

export default function OpenNow() {
  const { t, lang } = useLanguage()
  // Time is read after mount so server and client markup agree.
  const [hour, setHour] = useState<number | null>(null)

  useEffect(() => {
    const tick = () => setHour(myanmarHourNow())
    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [])

  const futsal = HOURS.futsal
  const open = hour !== null && futsal !== null && isOpenAt(futsal, hour)
  const daylight = hour !== null && hour >= RISE && hour < SET
  const p = sunPoint(hour ?? 9)

  const detail =
    futsal === null
      ? null
      : open
        ? t('park.open.futsalUntil', { time: formatHour(futsal.close, lang) })
        : t('park.open.futsalOpensAt', { time: formatHour(futsal.open, lang) })

  return (
    <div
      className="flex w-fit items-center gap-4 rounded-2xl bg-white px-4 py-3 shadow-[0_1px_0_rgb(15_77_60/0.08)]"
      aria-live="polite"
    >
      <svg width="64" height="40" viewBox="0 0 64 40" role="img" aria-label={t('park.open.sunLabel')} className="shrink-0">
        <path d="M6 34 A26 26 0 0 1 58 34" fill="none" className="stroke-park-line" strokeWidth="2" strokeDasharray="3 4" />
        {hour !== null &&
          (daylight ? (
            <circle cx={p.x} cy={p.y} r="6.5" className="fill-park-sun" />
          ) : (
            <path d="M34 10 a7 7 0 1 0 6 11 a5.5 5.5 0 1 1 -6 -11 z" className="fill-park-dusk" />
          ))}
        <line x1="2" y1="34" x2="62" y2="34" className="stroke-park-jungle" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <div className={hour === null ? 'invisible' : undefined}>
        <div className="font-bold text-park-jungle">{open ? t('park.open.now') : t('park.open.later')}</div>
        {detail && <div className="text-sm text-park-ink-soft">{detail}</div>}
      </div>
    </div>
  )
}
