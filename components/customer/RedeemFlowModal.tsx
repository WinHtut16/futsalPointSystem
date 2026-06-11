'use client'

import { useState, useEffect } from 'react'
import { Clock, Check, Gift } from 'lucide-react'
import type { Reward } from '@/types'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { getLocalizedText } from '@/lib/i18n/utils'
import { formatDateTime } from '@/lib/utils'
import Button from '@/components/ui/Button'

interface RedeemFlowModalProps {
  open: boolean
  onClose: () => void
  rewards: Reward[]
  userPoints: number
  initialRewardId?: string
  onRequested?: (rewardId: string, requestId: string) => void
}

type Step = 0 | 1 | 2

function formatRef(id: string): string {
  const year = new Date().getFullYear()
  const short = id.replace(/-/g, '').substring(0, 8).toUpperCase()
  return `RDM-${year}-${short}`
}

const STEP_KEYS = ['rewards.stepSelect', 'rewards.stepConfirm', 'rewards.stepSubmitted'] as const

export default function RedeemFlowModal({
  open,
  onClose,
  rewards,
  userPoints,
  initialRewardId,
  onRequested,
}: RedeemFlowModalProps) {
  const { t, lang } = useLanguage()
  const [step, setStep] = useState<Step>(0)
  const [selectedId, setSelectedId] = useState<string | null>(initialRewardId ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submittedId, setSubmittedId] = useState<string>('')
  const [submittedAt, setSubmittedAt] = useState<string>('')

  // Reset when opened with a specific reward
  useEffect(() => {
    if (open) {
      setStep(0)
      setSelectedId(initialRewardId ?? null)
      setError('')
      setSubmittedId('')
      setSubmittedAt('')
    }
  }, [open, initialRewardId])

  const selected = rewards.find((r) => r.id === selectedId) ?? null

  async function handleConfirm() {
    if (!selected) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/redemptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reward_id: selected.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Request failed.')
        return
      }
      setSubmittedId(data.id as string)
      setSubmittedAt(data.requested_at as string ?? new Date().toISOString())
      onRequested?.(selected.id, data.id as string)
      setStep(2)
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  const canAffordSelected = selected ? userPoints >= selected.points_cost : false
  const remaining = selected ? userPoints - selected.points_cost : userPoints

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="flex w-full max-h-[92dvh] flex-col overflow-hidden rounded-t-3xl bg-white md:max-h-[85vh] md:max-w-md md:rounded-2xl">
        {/* Drag handle (mobile only) */}
        <div className="flex justify-center pt-3 md:hidden">
          <div className="h-1 w-10 rounded-full bg-gray-200" />
        </div>

        {/* Header with stepper */}
        <div className="px-5 pt-4 pb-3 border-b border-gray-100">
          {/* Stepper */}
          <div className="flex items-center gap-1">
            {STEP_KEYS.map((key, i) => (
              <div key={key} className="flex items-center gap-1">
                {i > 0 && (
                  <div className={`h-px flex-1 w-5 transition-colors ${i <= step ? 'bg-primary' : 'bg-gray-200'}`} />
                )}
                <div className="flex items-center gap-1.5">
                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
                      i < step
                        ? 'bg-primary text-white'
                        : i === step
                        ? 'bg-primary text-white ring-2 ring-primary/20'
                        : 'border-2 border-gray-200 text-gray-400 bg-white'
                    }`}
                  >
                    {i < step ? <Check size={10} strokeWidth={3} /> : i + 1}
                  </div>
                  <span
                    className={`text-xs font-semibold transition-colors ${
                      i === step ? 'text-gray-900' : 'text-gray-400'
                    }`}
                  >
                    {t(key as never)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Step 0: Select ─────────────────────────────────────────── */}
        {step === 0 && (
          <>
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <p className="text-xs text-gray-400">{t('rewards.yourBalance' as never)}</p>
              <p className="text-sm font-bold text-gray-900">
                {userPoints.toLocaleString('en-US')} {t('rewards.pts')}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-2">
              {rewards.map((r) => {
                const name = getLocalizedText(r.name, r.name_my, lang)
                const desc = r.description ? getLocalizedText(r.description, r.description_my, lang) : null
                const affordable = userPoints >= r.points_cost
                const oos = r.stock !== null && r.stock <= 0
                const isSelected = r.id === selectedId
                if (oos) return null
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    disabled={!affordable}
                    className={`w-full rounded-2xl border-2 p-3.5 text-left transition-colors ${
                      isSelected
                        ? 'border-primary bg-primary-soft'
                        : affordable
                        ? 'border-gray-100 bg-white hover:border-gray-200'
                        : 'border-gray-100 bg-gray-50 opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] transition-colors ${
                          isSelected ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        <Gift size={16} strokeWidth={1.8} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-sm text-gray-900 leading-tight">{name}</p>
                          <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-600">
                            {r.points_cost.toLocaleString('en-US')} {t('rewards.pts')}
                          </span>
                        </div>
                        {desc && <p className="mt-0.5 text-xs text-gray-500 leading-snug">{desc}</p>}
                        {!affordable && (
                          <p className="mt-0.5 text-[11px] text-gray-400">{t('rewards.notEnoughPts')}</p>
                        )}
                      </div>
                    </div>
                    {/* Radio indicator */}
                    <div className="flex justify-end mt-2">
                      <div
                        className={`h-4 w-4 rounded-full border-2 transition-colors ${
                          isSelected ? 'border-primary bg-primary' : 'border-gray-300 bg-white'
                        } flex items-center justify-center`}
                      >
                        {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
            <div className="px-4 pb-5 pt-3 border-t border-gray-100">
              <Button
                className="w-full"
                disabled={!selectedId || !canAffordSelected}
                onClick={() => setStep(1)}
              >
                {t('rewards.continue' as never)}
              </Button>
            </div>
          </>
        )}

        {/* ── Step 1: Confirm ─────────────────────────────────────────── */}
        {step === 1 && selected && (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <h2 className="font-bold text-[17px] text-gray-900">{t('rewards.reviewTitle' as never)}</h2>

              {/* Selected reward */}
              <div className="rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-primary-soft text-primary">
                  <Gift size={20} strokeWidth={1.8} />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">
                    {getLocalizedText(selected.name, selected.name_my, lang)}
                  </p>
                  {selected.description && (
                    <p className="text-xs text-gray-500">
                      {getLocalizedText(selected.description, selected.description_my, lang)}
                    </p>
                  )}
                </div>
              </div>

              {/* Breakdown */}
              <div className="rounded-2xl bg-gray-50 p-4 space-y-2.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{t('rewards.currentBalance' as never)}</span>
                  <span className="font-semibold text-gray-900">
                    {userPoints.toLocaleString('en-US')} {t('rewards.pts')}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{t('rewards.thisReward' as never)}</span>
                  <span className="font-semibold text-red-500">
                    −{selected.points_cost.toLocaleString('en-US')} {t('rewards.pts')}
                  </span>
                </div>
                <div className="h-px bg-gray-200" />
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-gray-700">{t('rewards.remaining' as never)}</span>
                  <span className="font-bold text-gray-900">
                    {remaining.toLocaleString('en-US')} {t('rewards.pts')}
                  </span>
                </div>
              </div>

              {/* Note */}
              <p className="rounded-xl bg-blue-50 px-4 py-3 text-xs text-blue-700 leading-relaxed">
                {t('rewards.confirmNote' as never)}
              </p>

              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>

            <div className="px-4 pb-5 pt-3 border-t border-gray-100 flex gap-2.5">
              <Button variant="secondary" className="flex-1" onClick={() => setStep(0)}>
                {t('rewards.stepSelect' as never)}
              </Button>
              <Button className="flex-1" loading={loading} onClick={handleConfirm}>
                {t('rewards.confirmRedemption' as never)}
              </Button>
            </div>
          </>
        )}

        {/* ── Step 2: Submitted ─────────────────────────────────────── */}
        {step === 2 && selected && (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4">
              {/* Icon */}
              <div className="flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-500">
                  <Clock size={32} strokeWidth={1.5} />
                </div>
              </div>

              {/* Title */}
              <div className="text-center">
                <h2 className="text-lg font-bold text-gray-900">{t('rewards.submittedTitle' as never)}</h2>
                <p className="mt-1 text-sm text-gray-500">{t('rewards.submittedSub' as never)}</p>
              </div>

              {/* Ref card */}
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-base font-bold text-gray-900">{formatRef(submittedId)}</p>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                    {t('rewards.pendingApprovalBadge' as never)}
                  </span>
                </div>
                <div className="h-px bg-gray-200" />
                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">{t('rewards.rewardName' as never)}</span>
                    <span className="font-semibold text-gray-900">
                      {getLocalizedText(selected.name, selected.name_my, lang)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">{t('rewards.pointsHeld' as never)}</span>
                    <span className="font-semibold text-gray-900">
                      {selected.points_cost.toLocaleString('en-US')} {t('rewards.pts')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">{t('rewards.dateRequested' as never)}</span>
                    <span className="font-semibold text-gray-900 text-xs">
                      {formatDateTime(submittedAt, lang)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Info note */}
              <p className="rounded-xl bg-gray-50 px-4 py-3 text-xs text-gray-500 leading-relaxed">
                {t('rewards.heldNote' as never)}
              </p>
            </div>

            <div className="px-4 pb-5 pt-3 border-t border-gray-100 flex gap-2.5">
              <a
                href="/account?tab=points"
                className="flex flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {t('booking.viewMyRewards')}
              </a>
              <Button className="flex-1" onClick={onClose}>
                {t('rewards.done' as never)}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
