'use client'

import { useEffect, useState } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { HOURS } from '@/lib/park/content'
import { formatHour, isOpenAt, myanmarDayNow, myanmarHourNow } from '@/lib/park/time'
import SunArc from './SunArc'

// Sun (or moon) on a horizon arc for the current Myanmar time, plus what is
// open: the park grounds by day, then the futsal court after the park closes.
// The market lane never closes, so it is left out of the status.

export default function OpenNow() {
  const { t, lang } = useLanguage()
  // Time is read after mount so server and client markup agree.
  const [hour, setHour] = useState<number | null>(null)
  const [day, setDay] = useState<number | null>(null)

  useEffect(() => {
    const tick = () => {
      setHour(myanmarHourNow())
      setDay(myanmarDayNow())
    }
    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [])

  const park = HOURS.park
  const futsal = HOURS.futsal
  const at = (h: typeof park) => hour !== null && day !== null && h !== null && isOpenAt(h, hour, day)
  const parkOpen = at(park)
  const futsalOpen = at(futsal)
  const open = parkOpen || futsalOpen

  const detail = parkOpen
    ? t('park.open.parkUntil', { time: formatHour(park!.close, lang) })
    : futsalOpen
      ? t('park.open.futsalUntil', { time: formatHour(futsal!.close, lang) })
      : park
        ? t('park.open.parkOpensAt', { time: formatHour(park.open, lang) })
        : null

  return (
    <div
      className="flex w-fit items-center gap-4 rounded-2xl bg-white px-4 py-3 shadow-[0_1px_0_rgb(15_77_60/0.08)]"
      aria-live="polite"
    >
      <div role="img" aria-label={t('park.open.sunLabel')} className="h-10 w-16 shrink-0">
        <SunArc hour={hour} open={open} className="h-full w-full" />
      </div>
      <div className={hour === null ? 'invisible' : undefined}>
        <div className="font-bold text-park-jungle">{open ? t('park.open.now') : t('park.open.later')}</div>
        {detail && <div className="text-sm text-park-ink-soft">{detail}</div>}
      </div>
    </div>
  )
}
