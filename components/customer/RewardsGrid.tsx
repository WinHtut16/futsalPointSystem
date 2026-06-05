'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Reward } from '@/types'
import RewardCard from './RewardCard'

interface RewardsGridProps {
  rewards: Reward[]
  userId: string
  userPoints: number
  initialPendingMap: Record<string, string>
}

export default function RewardsGrid({ rewards, userId, userPoints, initialPendingMap }: RewardsGridProps) {
  const [pendingMap, setPendingMap] = useState<Record<string, string>>(initialPendingMap)

  const fetchPending = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('redemption_requests')
      .select('id, reward_id')
      .eq('customer_id', userId)
      .eq('status', 'pending')
    if (data) {
      const map: Record<string, string> = {}
      data.forEach((r: { id: string; reward_id: string }) => { map[r.reward_id] = r.id })
      setPendingMap(map)
    }
  }, [userId])

  const handleRequested = useCallback((rewardId: string, requestId: string) => {
    setPendingMap((prev) => ({ ...prev, [rewardId]: requestId }))
  }, [])

  const handleCancelled = useCallback((rewardId: string) => {
    setPendingMap((prev) => {
      const next = { ...prev }
      delete next[rewardId]
      return next
    })
  }, [])

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`customer-rewards-pending-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'redemption_requests',
          filter: `customer_id=eq.${userId}`,
        },
        (payload) => {
          try {
            const updated = payload.new as { id: string; reward_id: string; status: string }
            if (updated.status === 'approved' || updated.status === 'rejected') {
              setPendingMap((prev) => {
                const next = { ...prev }
                delete next[updated.reward_id]
                return next
              })
            }
          } catch (err) {
            console.error('[customer-rewards-pending] realtime handler error:', err)
          }
        }
      )
      .subscribe()

    const timer = setInterval(fetchPending, 20_000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(timer)
    }
  }, [userId, fetchPending])

  return (
    <div className="grid grid-cols-1 gap-3">
      {rewards.map((reward) => (
        <RewardCard
          key={reward.id}
          reward={reward}
          userPoints={userPoints}
          pendingRequestId={pendingMap[reward.id]}
          onRequested={handleRequested}
          onCancelled={handleCancelled}
        />
      ))}
    </div>
  )
}
