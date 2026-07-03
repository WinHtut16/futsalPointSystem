'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Subscribes to booking and closure changes for the visible calendar month,
 * calling onSlotChange(dateISO) whenever a slot state may have changed.
 *
 * Event-driven only — no polling. Channel name is a fixed string (slot state
 * is public, not user-specific). Re-subscribes only when visibleDates changes.
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

    // Broadcast events sent by API routes via broadcastSlotChange() bypass RLS,
    // so anonymous visitors and other customers' booking changes are all visible.
    const channel = supabase
      .channel('booking-slot-updates')
      .on('broadcast', { event: 'slot_changed' }, (payload) => {
        const date = (payload.payload as { date?: string } | null)?.date
        if (date && visibleSet.has(date)) onSlotChangeRef.current(date)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [visibleDates]) // eslint-disable-line react-hooks/exhaustive-deps
}
