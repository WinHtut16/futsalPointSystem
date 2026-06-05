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

const POLL_INTERVAL_MS = 15_000

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
    const supabase = createClient()

    const channel = supabase
      .channel('admin-pending-badge')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'redemption_requests' },
        (payload) => {
          try {
            if ((payload.new as { status: string }).status === 'pending') {
              setCount((c) => c + 1)
            }
          } catch (err) {
            console.error('[admin-pending-badge] INSERT handler error:', err)
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'redemption_requests' },
        (payload) => {
          try {
            const prev = (payload.old as { status?: string }).status
            const next = (payload.new as { status: string }).status
            if (prev === 'pending' && next !== 'pending') {
              setCount((c) => Math.max(0, c - 1))
            }
          } catch (err) {
            console.error('[admin-pending-badge] UPDATE handler error:', err)
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
    <PendingRedemptionsContext.Provider value={{ count }}>
      {children}
    </PendingRedemptionsContext.Provider>
  )
}

export function usePendingRedemptions(): PendingRedemptionsContextValue {
  return useContext(PendingRedemptionsContext)
}
