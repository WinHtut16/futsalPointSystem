'use client'

import { useEffect, useState } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { HOURS } from '@/lib/park/content'
import { formatHour, myanmarDayNow, myanmarHourNow, venueStatus, type VenueStatus } from '@/lib/park/time'

/** "Open now, until 5:30 PM" pill for the pool hero. Reads the clock after
 *  mount so the server and client render the same markup. */
export default function PoolStatus() {
  const { t, lang } = useLanguage()
  const [status, setStatus] = useState<VenueStatus | null>(null)

  useEffect(() => {
    const pool = HOURS.pool
    if (!pool) return
    const tick = () => setStatus(venueStatus(pool, myanmarHourNow(), myanmarDayNow()))
    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [])

  const text =
    status === null
      ? ' '
      : status.state === 'open'
        ? t('park.pool.status.open', { time: formatHour(status.until, lang) })
        : status.state === 'later'
          ? t('park.pool.status.later', { time: formatHour(status.opens, lang) })
          : status.state === 'closedDay'
            ? t('park.pool.status.closedDay', { time: formatHour(status.reopens, lang) })
            : t('park.pool.status.closedNow')
  const open = status?.state === 'open'

  return (
    <span
      aria-live="polite"
      className={`inline-flex min-h-[36px] items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-[#1a1d1f] ring-1 ring-black/10 transition-opacity ${
        status === null ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-2.5 w-2.5 rounded-full ${open ? 'pool-live bg-[#1f9d55]' : 'bg-[#b42318]'}`}
      />
      {text}
    </span>
  )
}
