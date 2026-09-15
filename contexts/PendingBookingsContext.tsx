'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { createClient } from '@/lib/supabase/client'

interface PendingBookingsContextValue {
  count: number
  loaded: boolean
}

const PendingBookingsContext = createContext<PendingBookingsContextValue>({ count: 0, loaded: false })

const POLL_INTERVAL_MS = 30_000

function myanmarToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Yangon' }).format(new Date())
}

function getMyanmarCurrentHourFrac(): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Yangon',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const h = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10)
  const m = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10)
  return h + m / 60
}

export function PendingBookingsProvider({
  initialCount,
  children,
}: {
  initialCount: number
  children: ReactNode
}) {
  const [count, setCount] = useState(initialCount)
  const [loaded, setLoaded] = useState(false)

  const fetchCount = useCallback(async () => {
    const supabase = createClient()
    const today = myanmarToday()
    const nowHourFrac = getMyanmarCurrentHourFrac()

    const [futureResult, todayResult] = await Promise.all([
      supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .eq('deposit_received', false)
        .gt('booking_date', today),
      supabase
        .from('bookings')
        .select('id, booking_slots(hour_start)')
        .eq('status', 'pending')
        .eq('deposit_received', false)
        .eq('booking_date', today),
    ])

    if (!futureResult.error && !todayResult.error) {
      const todayCount = (
        (todayResult.data ?? []) as { id: string; booking_slots: { hour_start: number }[] }[]
      ).filter((b) => {
        const slots = b.booking_slots ?? []
        return slots.length === 0 || slots.some((s) => s.hour_start + 1 > nowHourFrac)
      }).length
      setCount((futureResult.count ?? 0) + todayCount)
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    fetchCount()

    /**
     * Polled, never Realtime — and only while someone is looking.
     *
     * A postgres_changes channel used to sit here keeping the badge exact. It
     * could never connect: the browser client reaches Supabase through the
     * same-origin /sb rewrite so Myanmar operators have no *.supabase.co
     * hostname to filter, and Vercel does not upgrade WebSockets across a
     * rewrite. Worse, its status handler called fetchCount() on CHANNEL_ERROR,
     * so every doomed reconnect bought an extra query on top of the interval.
     *
     * Pausing on a hidden tab is the real saving. An admin who leaves the
     * dashboard open all shift was polling every 15s until they closed it; now
     * a background tab costs nothing and gets one fresh count the instant it
     * comes back to the foreground.
     */
    let timer: ReturnType<typeof setInterval> | undefined
    const start = () => {
      if (!timer) timer = setInterval(fetchCount, POLL_INTERVAL_MS)
    }
    const stop = () => {
      if (timer) {
        clearInterval(timer)
        timer = undefined
      }
    }
    const onVisibilityChange = () => {
      if (document.hidden) {
        stop()
      } else {
        void fetchCount()
        start()
      }
    }

    start()
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [fetchCount])

  return (
    <PendingBookingsContext.Provider value={{ count, loaded }}>
      {children}
    </PendingBookingsContext.Provider>
  )
}

export function usePendingBookings(): PendingBookingsContextValue {
  return useContext(PendingBookingsContext)
}