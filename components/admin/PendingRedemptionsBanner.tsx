'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const POLL_INTERVAL_MS = 20_000

export default function PendingRedemptionsBanner({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount)

  const fetchCount = useCallback(async () => {
    const supabase = createClient()
    const { count: fresh } = await supabase
      .from('redemption_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
    if (fresh !== null) setCount(fresh)
  }, [])

  useEffect(() => {
    const supabase = createClient()

    // Realtime: instant updates when Supabase delivers them
    const channel = supabase
      .channel('pending-redemptions')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'redemption_requests' },
        (payload) => {
          if ((payload.new as { status: string }).status === 'pending') {
            setCount((c) => c + 1)
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'redemption_requests' },
        (payload) => {
          const prev = (payload.old as { status?: string }).status
          const next = (payload.new as { status: string }).status
          if (prev === 'pending' && next !== 'pending') {
            setCount((c) => Math.max(0, c - 1))
          }
        }
      )
      .subscribe()

    // Polling: guaranteed fallback every 20 s
    const timer = setInterval(fetchCount, POLL_INTERVAL_MS)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(timer)
    }
  }, [fetchCount])

  if (count === 0) return null

  return (
    <Link href="/admin/redemptions">
      <div className="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
        <div>
          <p className="font-semibold text-yellow-800 text-sm">Pending Redemptions</p>
          <p className="text-xs text-yellow-600">Tap to review and approve at the counter</p>
        </div>
        <span className="bg-yellow-400 text-yellow-900 font-bold text-sm px-2.5 py-0.5 rounded-full">
          {count}
        </span>
      </div>
    </Link>
  )
}
