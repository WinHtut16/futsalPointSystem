'use client'

import { useState } from 'react'
import { Gift, Clock } from 'lucide-react'
import type { RedemptionRequest } from '@/types'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { getAvatarColor, getInitials } from '@/lib/avatar'
import ConfirmModal from '@/components/ui/ConfirmModal'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function refCode(id: string) {
  return `#${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`
}

export default function RedemptionRequestCard({
  request,
  onResolved,
}: {
  request: RedemptionRequest
  onResolved: (id: string) => void
}) {
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState('')
  const [showRejectConfirm, setShowRejectConfirm] = useState(false)
  const { t } = useLanguage()

  const name = request.customer?.username ?? '—'
  const color = getAvatarColor(name)
  const initials = getInitials(name)

  async function handleAction(action: 'approve' | 'reject') {
    setLoading(action)
    setError('')
    const res = await fetch(`/api/redemptions/${request.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    const data = await res.json()
    setLoading(null)
    if (!res.ok) {
      setError(data.error ?? 'Action failed.')
      return
    }
    onResolved(request.id)
  }

  return (
    <div className="bg-amber-50/60 border border-amber-100 rounded-2xl p-4 space-y-3">
      {/* Header: customer + reward info */}
      <div className="flex items-start gap-3">
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${color.bg} ${color.text}`}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
              <p className="text-xs text-gray-500">{request.customer?.phone}</p>
            </div>
            <span className="text-xs text-gray-400 shrink-0">{timeAgo(request.requested_at)}</span>
          </div>
        </div>
      </div>

      {/* Reward info */}
      <div className="flex items-center gap-2.5 bg-white rounded-xl px-3 py-2.5 border border-amber-100">
        <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
          <Gift className="w-4 h-4 text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">{request.reward?.name}</p>
          <p className="text-xs text-brand-600 font-bold">
            {request.reward?.points_cost} {t('common.pts')}
          </p>
        </div>
        <span className="text-xs text-gray-400 font-mono shrink-0">{refCode(request.id)}</span>
      </div>

      {/* Balance info */}
      <p className="text-xs text-gray-400">
        {t('admin.ptsAvailable')}: {request.customer?.total_points?.toLocaleString()} pts
      </p>

      {error && (
        <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          disabled={!!loading}
          onClick={() => setShowRejectConfirm(true)}
          className="flex-1 py-2 px-4 rounded-xl border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
        >
          {loading === 'reject' ? (
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : null}
          {t('admin.reject')}
        </button>
        <button
          disabled={!!loading}
          onClick={() => handleAction('approve')}
          className="flex-1 py-2 px-4 rounded-xl bg-primary text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
        >
          {loading === 'approve' ? (
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : null}
          {t('admin.approve')}
        </button>
      </div>
      <ConfirmModal
        isOpen={showRejectConfirm}
        onClose={() => setShowRejectConfirm(false)}
        onConfirm={() => { setShowRejectConfirm(false); handleAction('reject') }}
        title="Decline request"
        message="The customer's held points will be released back to their balance."
        confirmLabel={t('admin.reject')}
        variant="warning"
        isLoading={loading === 'reject'}
      />
    </div>
  )
}
