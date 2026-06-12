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

const POLL_INTERVAL_MS = 15_000

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

    const supabase = createClient()

    const channel = supabase
      .channel('admin-pending-bookings-badge')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bookings' },
        (payload) => {
          try {
            const b = payload.new as { status: string; booking_date: string; deposit_received: boolean }
            if (b.status !== 'pending' || b.deposit_received) return
            const today = myanmarToday()
            if (b.booking_date < today) return
            if (b.booking_date > today) {
              setCount((c) => c + 1)
            } else {
              // Today: need slot data to determine if future — refetch for accuracy
              fetchCount()
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
            const today = myanmarToday()
            if (neu.booking_date < today) return
            if (neu.booking_date > today) {
              const prevInBadge = old.status === 'pending' && old.deposit_received === false
              const nextInBadge = neu.status === 'pending' && neu.deposit_received === false
              if (prevInBadge && !nextInBadge) setCount((c) => Math.max(0, c - 1))
              else if (!prevInBadge && nextInBadge) setCount((c) => c + 1)
            } else {
              // Today: need slot data to determine active/grace — refetch for accuracy
              fetchCount()
            }
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
    <PendingBookingsContext.Provider value={{ count, loaded }}>
      {children}
    </PendingBookingsContext.Provider>
  )
}

export function usePendingBookings(): PendingBookingsContextValue {
  return useContext(PendingBookingsContext)
}