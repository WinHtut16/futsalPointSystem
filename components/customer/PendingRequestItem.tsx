'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { RedemptionRequest } from '@/types'
import { formatDate } from '@/lib/utils'

export default function PendingRequestItem({ request }: { request: RedemptionRequest }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [cancelled, setCancelled] = useState(false)

  async function handleCancel() {
    setLoading(true)
    const res = await fetch(`/api/redemptions/${request.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    })
    setLoading(false)
    if (res.ok) {
      setCancelled(true)
      router.refresh()
    }
  }

  if (cancelled) return null

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-lg bg-yellow-100">
          ⏳
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">
            {request.reward?.name ?? 'Reward'}
          </p>
          <p className="text-xs text-yellow-600 font-medium">Pending approval</p>
          <p className="text-xs text-gray-400">{formatDate(request.requested_at)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-2">
        <span className="text-sm font-bold text-gray-400">
          -{request.reward?.points_cost} pts
        </span>
        <button
          onClick={handleCancel}
          disabled={loading}
          className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 border border-red-200 rounded-lg px-2 py-1"
        >
          {loading ? '...' : 'Cancel'}
        </button>
      </div>
    </div>
  )
}
