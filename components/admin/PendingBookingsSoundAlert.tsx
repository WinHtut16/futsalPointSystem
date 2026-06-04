'use client'

import { useEffect, useRef } from 'react'
import { usePendingBookings } from '@/contexts/PendingBookingsContext'
import { playBookingBeep } from '@/lib/notificationSound'

/**
 * Render-nothing component. Plays an ascending beep when pending booking count increases.
 * Must be rendered inside <PendingBookingsProvider>.
 */
export default function PendingBookingsSoundAlert() {
  const { count } = usePendingBookings()
  const prevCountRef = useRef<number | null>(null)

  useEffect(() => {
    if (prevCountRef.current === null) {
      prevCountRef.current = count
      return
    }

    if (count > prevCountRef.current) {
      playBookingBeep()
    }

    prevCountRef.current = count
  }, [count])

  return null
}
