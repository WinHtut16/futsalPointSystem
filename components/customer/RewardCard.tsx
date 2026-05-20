'use client'

import { useState } from 'react'
import type { Reward } from '@/types'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { useRouter } from 'next/navigation'

interface RewardCardProps {
  reward: Reward
  userPoints: number
}

export default function RewardCard({ reward, userPoints }: RewardCardProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const canAfford = userPoints >= reward.points_cost
  const outOfStock = reward.stock !== null && reward.stock <= 0

  async function handleRedeem() {
    setLoading(true)
    setError('')
    const res = await fetch('/api/points/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reward_id: reward.id }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      setError(data.error ?? 'Redemption failed.')
      return
    }
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
        <div>
          <p className="font-semibold text-gray-900">{reward.name}</p>
          {reward.description && (
            <p className="text-xs text-gray-500 mt-0.5">{reward.description}</p>
          )}
          {reward.stock !== null && (
            <p className="text-xs text-gray-400 mt-0.5">{reward.stock} left</p>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-brand-600 font-bold text-lg">{reward.points_cost} pts</span>
          <Button
            size="sm"
            variant={canAfford && !outOfStock ? 'primary' : 'secondary'}
            disabled={!canAfford || outOfStock}
            onClick={() => setOpen(true)}
          >
            {outOfStock ? 'Out of stock' : canAfford ? 'Redeem' : 'Not enough pts'}
          </Button>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Confirm Redemption">
        <div className="space-y-4">
          <p className="text-gray-700 text-sm">
            Redeem <strong>{reward.name}</strong> for{' '}
            <strong className="text-brand-600">{reward.points_cost} points</strong>?
          </p>
          <p className="text-gray-500 text-sm">
            Remaining after: <strong>{(userPoints - reward.points_cost).toLocaleString()} pts</strong>
          </p>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3">
            <Button variant="secondary" size="md" onClick={() => setOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button size="md" loading={loading} onClick={handleRedeem} className="flex-1">
              Confirm
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
