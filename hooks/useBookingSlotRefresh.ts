'use client'

import { useEffect, useRef } from 'react'

const POLL_INTERVAL_MS = 15_000

/**
 * Keeps the booking day the customer is looking at up to date.
 *
 * This was a Supabase Realtime subscription across the whole visible month. It
 * had to go: Realtime is a WebSocket to *.supabase.co, and on 2026-08-22 that
 * connection was measured being refused outright in under 100ms on Ooredoo
 * mobile while succeeding on WiFi from the same handset. It also cannot follow
 * the rest of our Supabase traffic through the /sb rewrite, because Vercel does
 * not upgrade WebSocket connections across a rewrite. So for a large share of
 * customers this was already dead, and for the rest it was about to be.
 *
 * /api/bookings/availability is a route handler on this app's own origin, which
 * every network we tested reaches. The trade is up to POLL_INTERVAL_MS of
 * staleness on the calendar. That is a display concern only — double-booking is
 * prevented in Postgres by the slot conflict constraints, not by this hook.
 *
 * Only the selected day is polled, not the whole month: it is the one the
 * customer is about to act on, and it keeps this to a single small request per
 * interval instead of one per day in view.
 */
export function useBookingSlotRefresh(
  focusDate: string | null,
  onSlotChange: (date: string) => void
): void {
  // Stable ref so the interval always calls the latest callback without
  // resubscribing on every render.
  const onSlotChangeRef = useRef(onSlotChange)
  useEffect(() => {
    onSlotChangeRef.current = onSlotChange
  })

  useEffect(() => {
    if (!focusDate) return

    const refresh = () => {
      // Never spend a customer's mobile data on a tab they are not looking at;
      // the visibilitychange listener catches them up the moment they return.
      if (document.visibilityState !== 'visible') return
      onSlotChangeRef.current(focusDate)
    }

    // Immediately, because the day may have been selected from calendar data
    // rendered minutes ago — waiting a full interval would show stale slots at
    // exactly the moment the customer is choosing one.
    refresh()

    const timer = setInterval(refresh, POLL_INTERVAL_MS)
    const onVisibilityChange = () => refresh()

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', refresh)

    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', refresh)
    }
  }, [focusDate])
}
