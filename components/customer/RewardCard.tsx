'use client'

import { useState } from 'react'
import type { Reward } from '@/types'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface RewardCardProps {
  reward: Reward
  userPoints: number
  pendingRequestId?: string
  onRequested?: (rewardId: string, requestId: string) => void
  onCancelled?: (rewardId: string) => void
}

export default function RewardCard({ reward, userPoints, pendingRequestId, onRequested, onCancelled }: RewardCardProps) {
  const { t } = useLanguage()
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
    onRequested?.(reward.id, data.id)
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
      onCancelled?.(reward.id)
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
            <p className="text-xs text-gray-400 mt-0.5">{reward.stock} {t('rewards.left')}</p>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-brand-600 font-bold text-lg">{reward.points_cost} {t('rewards.pts')}</span>
          {isPending ? (
            <div className="flex items-center gap-2">
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium">
                {t('rewards.pending')}
              </span>
              <Button size="sm" variant="secondary" onClick={() => setCancelOpen(true)}>
                {t('rewards.cancel')}
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant={canAfford && !outOfStock ? 'primary' : 'secondary'}
              disabled={!canAfford || outOfStock}
              onClick={() => setConfirmOpen(true)}
            >
              {outOfStock
                ? t('rewards.outOfStock')
                : canAfford
                ? t('rewards.request')
                : t('rewards.notEnoughPts')}
            </Button>
          )}
        </div>
      </div>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title={t('rewards.requestRedemption')}>
        <div className="space-y-4">
          <p className="text-gray-700 text-sm">
            {t('rewards.requestRedemption')} <strong>{reward.name}</strong>{' '}
            <strong className="text-brand-600">{reward.points_cost} {t('rewards.pts')}</strong>?
          </p>
          <p className="text-gray-500 text-xs bg-gray-50 rounded-lg p-3">
            {t('rewards.adminApproveNote')}
          </p>
          <p className="text-xs text-gray-400">
            {t('rewards.remainingAfter')}{' '}
            <strong>{(userPoints - reward.points_cost).toLocaleString()} {t('rewards.pts')}</strong>
          </p>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3">
            <Button variant="secondary" size="md" onClick={() => setConfirmOpen(false)} className="flex-1">
              {t('rewards.cancel')}
            </Button>
            <Button size="md" loading={loading} onClick={handleRequest} className="flex-1">
              {t('rewards.sendRequest')}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title={t('rewards.cancelRequest')}>
        <div className="space-y-4">
          <p className="text-gray-700 text-sm">
            {t('rewards.cancelRequest')} <strong>{reward.name}</strong>?
          </p>
          <p className="text-gray-500 text-xs">{t('rewards.pointsNotDeducted')}</p>
          <div className="flex gap-3">
            <Button variant="secondary" size="md" onClick={() => setCancelOpen(false)} className="flex-1">
              {t('rewards.keep')}
            </Button>
            <Button size="md" loading={loading} onClick={handleCancel} className="flex-1">
              {t('rewards.cancelRequest')}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
