'use client'

import { useState } from 'react'
import { Clock } from 'lucide-react'
import type { RedemptionRequest } from '@/types'
import { formatDateTime } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function PendingRequestItem({
  request,
  onResolved,
}: {
  request: RedemptionRequest
  onResolved: (id: string) => void
}) {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(false)

  async function handleCancel() {
    setLoading(true)
    const res = await fetch(`/api/redemptions/${request.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    })
    setLoading(false)
    if (res.ok) onResolved(request.id)
  }

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center bg-yellow-100">
          <Clock className="w-4 h-4 text-yellow-600" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">
            {request.reward?.name ?? t('tx.redemption')}
          </p>
          <p className="text-xs text-yellow-600 font-medium">{t('history.pendingApproval')}</p>
          <p className="text-xs text-gray-400">{formatDateTime(request.requested_at)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-2">
        <span className="text-sm font-bold text-gray-400">
          -{request.reward?.points_cost} {t('rewards.pts')}
        </span>
        <button
          onClick={handleCancel}
          disabled={loading}
          className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 border border-red-200 rounded-lg px-2 py-1"
        >
          {loading ? '...' : t('history.cancel')}
        </button>
      </div>
    </div>
  )
}
