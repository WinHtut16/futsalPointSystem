'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Subscribes to booking and closure changes for the visible calendar month,
 * calling onSlotChange(dateISO) whenever a slot state may have changed.
 *
 * Two-tier pattern: realtime subscription (instant when RLS permits) +
 * 30-second polling fallback (guaranteed for all users regardless of auth).
 *
 * Channel name is a fixed string — slot state is public, not user-specific.
 * Re-subscribes only when visibleDates changes (i.e. the month changes).
 */
export function useBookingSlotRealtime(
  visibleDates: string[],
  onSlotChange: (date: string) => void
): void {
  // Stable ref so realtime callbacks always call the latest version of
  // onSlotChange without needing it as a useEffect dependency (which would
  // recreate the channel on every render).
  const onSlotChangeRef = useRef(onSlotChange)
  useEffect(() => {
    onSlotChangeRef.current = onSlotChange
  })

  useEffect(() => {
    if (visibleDates.length === 0) return

    const visibleSet = new Set(visibleDates)
    const supabase = createClient()

    const channel = supabase
      .channel('booking-slot-updates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bookings' },
        (payload) => {
          const date = (payload.new as { booking_date?: string }).booking_date
          if (date && visibleSet.has(date)) onSlotChangeRef.current(date)
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'bookings' },
        (payload) => {
          const row = (payload.new ?? payload.old) as { booking_date?: string }
          const date = row.booking_date
          if (date && visibleSet.has(date)) onSlotChangeRef.current(date)
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'court_closures' },
        (payload) => {
          const date = (payload.new as { closure_date?: string }).closure_date
          if (date && visibleSet.has(date)) onSlotChangeRef.current(date)
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'court_closures' },
        (payload) => {
          const row = (payload.new ?? payload.old) as { closure_date?: string }
          const date = row.closure_date
          if (date && visibleSet.has(date)) onSlotChangeRef.current(date)
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'court_closures' },
        (payload) => {
          const date = (payload.old as { closure_date?: string }).closure_date
          if (date && visibleSet.has(date)) onSlotChangeRef.current(date)
        }
      )
      .subscribe()

    // 30-second polling fallback: refreshes all visible dates regardless of
    // whether the realtime subscription is active (covers anon users and
    // RLS-restricted cases).
    const intervalId = setInterval(() => {
      for (const date of visibleDates) {
        onSlotChangeRef.current(date)
      }
    }, 30_000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(intervalId)
    }
  }, [visibleDates]) // eslint-disable-line react-hooks/exhaustive-deps
}
