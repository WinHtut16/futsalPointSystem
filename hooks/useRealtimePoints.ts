import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const POLL_INTERVAL_MS = 20_000

/**
 * The customer's own points total, kept fresh.
 *
 * POLLING, NOT REALTIME, AND THAT IS THE POINT. The browser Supabase client is
 * aimed at the same-origin /sb passthrough so that Myanmar operators filtering
 * *.supabase.co have no hostname to match on. Vercel does not upgrade WebSocket
 * connections through a rewrite - next.config.js says so where the rule is
 * defined - so `supabase.channel(...).subscribe()` over that path can never
 * connect.
 *
 * It used to be here anyway, next to the poll. It never once succeeded; it just
 * failed and retried, on a loop, on every customer's phone, for as long as the
 * points screen was open. The poll below is what was actually keeping this
 * number current the whole time. The subscription is gone.
 *
 * The name is now a small lie. Kept as-is deliberately: renaming it would touch
 * RealtimePointsBadge and read as a behaviour change in the diff, when nothing
 * a customer can see has changed.
 */
export function useRealtimePoints(userId: string, initialPoints: number): number {
  const [points, setPoints] = useState(initialPoints)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | undefined

    async function refresh() {
      const { data } = await supabase
        .from('profiles')
        .select('total_points')
        .eq('id', userId)
        .single()
      // The await means this can land after unmount, or after a userId change
      // queued a second effect - setting state then would either warn or show
      // the previous customer's total.
      if (!cancelled && data) setPoints(data.total_points)
    }

    function start() {
      if (!timer) timer = setInterval(refresh, POLL_INTERVAL_MS)
    }
    function stop() {
      if (timer) {
        clearInterval(timer)
        timer = undefined
      }
    }

    // A phone left on this screen in someone's pocket should not keep waking
    // the radio every 20 seconds. Refresh once on return so the number the
    // customer sees when they look again is current, then resume.
    function onVisibilityChange() {
      if (document.hidden) {
        stop()
      } else {
        void refresh()
        start()
      }
    }

    start()
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      stop()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [userId])

  return points
}
