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

interface PendingRedemptionsContextValue {
  count: number
}

const PendingRedemptionsContext = createContext<PendingRedemptionsContextValue>({ count: 0 })

const POLL_INTERVAL_MS = 30_000

export function PendingRedemptionsProvider({
  initialCount,
  children,
}: {
  initialCount: number
  children: ReactNode
}) {
  const [count, setCount] = useState(initialCount)

  const fetchCount = useCallback(async () => {
    const supabase = createClient()
    const { count: fresh, error } = await supabase
      .from('redemption_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
    if (!error && fresh !== null) setCount(fresh)
  }, [])

  useEffect(() => {
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
    <PendingRedemptionsContext.Provider value={{ count }}>
      {children}
    </PendingRedemptionsContext.Provider>
  )
}

export function usePendingRedemptions(): PendingRedemptionsContextValue {
  return useContext(PendingRedemptionsContext)
}
