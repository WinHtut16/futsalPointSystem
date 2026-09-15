'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Gift } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { Reward } from '@/types'
import RewardCard from './RewardCard'
import RedeemFlowModal from './RedeemFlowModal'

interface RewardsGridProps {
  rewards: Reward[]
  userId: string
  userPoints: number
  initialPendingMap: Record<string, string>
}

export default function RewardsGrid({ rewards, userId, userPoints, initialPendingMap }: RewardsGridProps) {
  const { t } = useLanguage()
  const [pendingMap, setPendingMap] = useState<Record<string, string>>(initialPendingMap)
  const [flowOpen, setFlowOpen] = useState(false)
  const [flowRewardId, setFlowRewardId] = useState<string | undefined>(undefined)

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

  const handleRedeem = useCallback((reward: Reward) => {
    setFlowRewardId(reward.id)
    setFlowOpen(true)
  }, [])

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

  /**
   * Refreshed on a timer, never over Realtime.
   *
   * A postgres_changes channel used to live here. It never connected once: the
   * browser Supabase client talks through the same-origin /sb rewrite so that
   * Myanmar operators filtering *.supabase.co have no hostname to match, and
   * Vercel does not upgrade WebSocket connections across a rewrite - which
   * next.config.js says in full where that rule is defined. All the channel
   * ever did was fail and retry, on a loop, for as long as this screen was
   * open. The poll below was doing the real work the whole time.
   */
  useEffect(() => {
    const timer = setInterval(fetchPending, 20_000)
    return () => clearInterval(timer)
  }, [fetchPending])

  // Empty state
  if (rewards.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-white p-8 text-center shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-400">
          <Gift size={28} strokeWidth={1.5} />
        </div>
        <div>
          <p className="font-semibold text-gray-900">{t('rewards.noRewardsTitle' as never)}</p>
          <p className="mt-1 text-sm text-gray-500 max-w-[260px] leading-relaxed">
            {t('rewards.noRewardsSub' as never)}
          </p>
        </div>
        <Link
          href="/"
          className="rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-200 transition-colors"
        >
          {t('rewards.noRewardsBack' as never)}
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {rewards.map((reward) => (
          <RewardCard
            key={reward.id}
            reward={reward}
            userPoints={userPoints}
            pendingRequestId={pendingMap[reward.id]}
            onRedeem={handleRedeem}
            onCancelled={handleCancelled}
          />
        ))}

        {/* Counter note */}
        <p className="mt-1 text-center text-xs text-gray-400 leading-relaxed">
          {t('rewards.counterNote' as never)}
        </p>
      </div>

      <RedeemFlowModal
        open={flowOpen}
        onClose={() => setFlowOpen(false)}
        rewards={rewards}
        userPoints={userPoints}
        initialRewardId={flowRewardId}
        onRequested={handleRequested}
      />
    </>
  )
}
