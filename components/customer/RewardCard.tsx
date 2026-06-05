'use client'

import { useState } from 'react'
import { Gift } from 'lucide-react'
import type { Reward } from '@/types'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { getLocalizedText } from '@/lib/i18n/utils'

interface RewardCardProps {
  reward: Reward
  userPoints: number
  pendingRequestId?: string
  onRedeem?: (reward: Reward) => void
  onCancelled?: (rewardId: string) => void
}

export default function RewardCard({ reward, userPoints, pendingRequestId, onRedeem, onCancelled }: RewardCardProps) {
  const { t, lang } = useLanguage()
  const displayName = getLocalizedText(reward.name, reward.name_my, lang)
  const displayDesc = reward.description
    ? getLocalizedText(reward.description, reward.description_my, lang)
    : null
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)

  const canAfford = userPoints >= reward.points_cost
  const outOfStock = reward.stock !== null && reward.stock <= 0
  const isLimited = reward.stock !== null && reward.stock > 0
  const isPending = !!pendingRequestId

  async function handleCancel() {
    setCancelLoading(true)
    const res = await fetch(`/api/redemptions/${pendingRequestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    })
    setCancelLoading(false)
    if (res.ok) {
      setCancelOpen(false)
      onCancelled?.(reward.id)
    }
  }

  return (
    <>
      <div className="flex items-start gap-3.5 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        {/* Icon */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--r-md,12px)] bg-primary-soft text-primary">
          <Gift size={20} strokeWidth={1.8} />
        </div>

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="font-semibold text-gray-900 leading-tight">{displayName}</p>
                {isLimited && (
                  <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700">
                    {t('rewards.limited' as never)}
                  </span>
                )}
              </div>
              {displayDesc && (
                <p className="mt-0.5 text-xs text-gray-500 leading-snug">{displayDesc}</p>
              )}
              {reward.stock !== null && !outOfStock && (
                <p className="mt-0.5 text-[11px] text-gray-400">
                  {reward.stock} {t('rewards.left')}
                </p>
              )}
            </div>
            {/* Points cost badge */}
            <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-600">
              {reward.points_cost.toLocaleString('en-US')} {t('rewards.pts')}
            </span>
          </div>

          {/* Action row */}
          <div className="flex items-center justify-end">
            {isPending ? (
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-semibold text-yellow-700">
                  {t('rewards.pending')}
                </span>
                <Button size="sm" variant="secondary" onClick={() => setCancelOpen(true)}>
                  {t('rewards.cancel')}
                </Button>
              </div>
            ) : outOfStock ? (
              <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-400">
                {t('rewards.outOfStock')}
              </span>
            ) : (
              <Button
                size="sm"
                variant={canAfford ? 'primary' : 'secondary'}
                disabled={!canAfford}
                onClick={() => onRedeem?.(reward)}
              >
                {canAfford ? t('rewards.redeem' as never) : t('rewards.notEnoughPts')}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Cancel confirmation modal */}
      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title={t('rewards.cancelRequest')}>
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            {t('rewards.cancelRequest')} <strong>{displayName}</strong>?
          </p>
          <p className="text-xs text-gray-500">{t('rewards.pointsNotDeducted')}</p>
          <div className="flex gap-3">
            <Button variant="secondary" size="md" onClick={() => setCancelOpen(false)} className="flex-1">
              {t('rewards.keep')}
            </Button>
            <Button size="md" loading={cancelLoading} onClick={handleCancel} className="flex-1">
              {t('rewards.cancelRequest')}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
