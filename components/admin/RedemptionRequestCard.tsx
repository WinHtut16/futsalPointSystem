'use client'

import { useState } from 'react'
import type { RedemptionRequest } from '@/types'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { useLanguage } from '@/lib/i18n/LanguageContext'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
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
  const { t } = useLanguage()

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
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 truncate">{request.customer?.username}</p>
          <p className="text-xs text-gray-500">{request.customer?.phone}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {request.customer?.total_points?.toLocaleString()} {t('admin.ptsAvailable')}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-medium text-gray-800">{request.reward?.name}</p>
          <p className="text-brand-600 font-bold text-sm">{request.reward?.points_cost} pts</p>
          <p className="text-xs text-gray-400 mt-0.5">{timeAgo(request.requested_at)}</p>
        </div>
      </div>
      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
      <div className="flex gap-2 mt-4">
        <Button
          variant="secondary"
          size="sm"
          className="flex-1"
          loading={loading === 'reject'}
          disabled={!!loading}
          onClick={() => handleAction('reject')}
        >
          {t('admin.reject')}
        </Button>
        <Button
          size="sm"
          className="flex-1"
          loading={loading === 'approve'}
          disabled={!!loading}
          onClick={() => handleAction('approve')}
        >
          {t('admin.approve')}
        </Button>
      </div>
    </Card>
  )
}
