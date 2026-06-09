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
}

const PendingBookingsContext = createContext<PendingBookingsContextValue>({ count: 0 })

const POLL_INTERVAL_MS = 15_000

function myanmarToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Yangon' }).format(new Date())
}

export function PendingBookingsProvider({
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
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .eq('deposit_received', false)
      .gte('booking_date', myanmarToday())
    if (!error && fresh !== null) setCount(fresh)
  }, [])

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('admin-pending-bookings-badge')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bookings' },
        (payload) => {
          try {
            const b = payload.new as { status: string; booking_date: string; deposit_received: boolean }
            if (b.status === 'pending' && !b.deposit_received && b.booking_date >= myanmarToday()) {
              setCount((c) => c + 1)
            }
          } catch (err) {
            console.error('[admin-pending-bookings-badge] INSERT handler error:', err)
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'bookings' },
        (payload) => {
          try {
            const old = payload.old as { status?: string; deposit_received?: boolean; booking_date?: string }
            const neu = payload.new as { status: string; deposit_received: boolean; booking_date: string }
            if (neu.booking_date < myanmarToday()) return
            const prevInBadge = old.status === 'pending' && old.deposit_received === false
            const nextInBadge = neu.status === 'pending' && neu.deposit_received === false
            if (prevInBadge && !nextInBadge) setCount((c) => Math.max(0, c - 1))
            else if (!prevInBadge && nextInBadge) setCount((c) => c + 1)
          } catch (err) {
            console.error('[admin-pending-bookings-badge] UPDATE handler error:', err)
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          fetchCount()
        }
      })

    const timer = setInterval(fetchCount, POLL_INTERVAL_MS)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(timer)
    }
  }, [fetchCount])

  return (
    <PendingBookingsContext.Provider value={{ count }}>
      {children}
    </PendingBookingsContext.Provider>
  )
}

export function usePendingBookings(): PendingBookingsContextValue {
  return useContext(PendingBookingsContext)
}