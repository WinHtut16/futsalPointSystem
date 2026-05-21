'use client'

import { useState } from 'react'
import type { Reward } from '@/types'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { useRouter } from 'next/navigation'

interface RewardCardProps {
  reward: Reward
  userPoints: number
  pendingRequestId?: string
}

export default function RewardCard({ reward, userPoints, pendingRequestId }: RewardCardProps) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const canAfford = userPoints >= reward.points_cost
  const outOfStock = reward.stock !== null && reward.stock <= 0
  const isPending = !!pendingRequestId

  async function handleRequest() {
    setLoading(true)
    setError('')
    const res = await fetch('/api/redemptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reward_id: reward.id }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      setError(data.error ?? 'Request failed.')
      return
    }
    setConfirmOpen(false)
    router.refresh()
  }

  async function handleCancel() {
    setLoading(true)
    const res = await fetch(`/api/redemptions/${pendingRequestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    })
    setLoading(false)
    if (res.ok) {
      setCancelOpen(false)
      router.refresh()
    }
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
          {isPending ? (
            <div className="flex items-center gap-2">
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium">
                Pending...
              </span>
              <Button size="sm" variant="secondary" onClick={() => setCancelOpen(true)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant={canAfford && !outOfStock ? 'primary' : 'secondary'}
              disabled={!canAfford || outOfStock}
              onClick={() => setConfirmOpen(true)}
            >
              {outOfStock ? 'Out of stock' : canAfford ? 'Request' : 'Not enough pts'}
            </Button>
          )}
        </div>
      </div>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Request Redemption">
        <div className="space-y-4">
          <p className="text-gray-700 text-sm">
            Request <strong>{reward.name}</strong> for{' '}
            <strong className="text-brand-600">{reward.points_cost} points</strong>?
          </p>
          <p className="text-gray-500 text-xs bg-gray-50 rounded-lg p-3">
            Your points will only be deducted when an admin approves your request at the counter.
          </p>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3">
            <Button variant="secondary" size="md" onClick={() => setConfirmOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button size="md" loading={loading} onClick={handleRequest} className="flex-1">
              Send Request
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel Request">
        <div className="space-y-4">
          <p className="text-gray-700 text-sm">
            Cancel your pending request for <strong>{reward.name}</strong>?
          </p>
          <p className="text-gray-500 text-xs">Your points have not been deducted.</p>
          <div className="flex gap-3">
            <Button variant="secondary" size="md" onClick={() => setCancelOpen(false)} className="flex-1">
              Keep
            </Button>
            <Button size="md" loading={loading} onClick={handleCancel} className="flex-1">
              Cancel Request
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
