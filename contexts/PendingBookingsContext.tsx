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
          if ((payload.new as { status: string }).status === 'pending') {
            setCount((c) => c + 1)
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'bookings' },
        (payload) => {
          const prev = (payload.old as { status?: string }).status
          const next = (payload.new as { status: string }).status
          if (prev === 'pending' && next !== 'pending') {
            setCount((c) => Math.max(0, c - 1))
          } else if (prev !== 'pending' && next === 'pending') {
            setCount((c) => c + 1)
          }
        }
      )
      .subscribe()

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