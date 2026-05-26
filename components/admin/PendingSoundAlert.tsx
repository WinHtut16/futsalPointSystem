'use client'

import { useEffect, useRef } from 'react'
import { usePendingRedemptions } from '@/contexts/PendingRedemptionsContext'
import { playNotificationBeep } from '@/lib/notificationSound'

/**
 * Render-nothing component. Plays a beep when pending request count increases.
 * Must be rendered inside <PendingRedemptionsProvider>.
 */
export default function PendingSoundAlert() {
  const { count } = usePendingRedemptions()
  const prevCountRef = useRef<number | null>(null)

  useEffect(() => {
    // First render: record baseline count without playing sound
    if (prevCountRef.current === null) {
      prevCountRef.current = count
      return
    }

    // Subsequent renders: play sound only when count increases
    if (count > prevCountRef.current) {
      playNotificationBeep()
    }

    prevCountRef.current = count
  }, [count])

  return null
}
