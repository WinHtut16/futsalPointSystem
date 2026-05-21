'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Reward } from '@/types'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'

interface RewardAdminRowProps {
  reward: Reward
  canManage: boolean
}

export default function RewardAdminRow({ reward, canManage }: RewardAdminRowProps) {
  const router = useRouter()
  const [toggling, setToggling] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function toggleActive() {
    setToggling(true)
    await fetch(`/api/rewards/${reward.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !reward.is_active }),
    })
    setToggling(false)
    router.refresh()
  }

  async function handleDelete() {
    if (!confirm(`Delete "${reward.name}"? This cannot be undone.`)) return
    setDeleting(true)
    await fetch(`/api/rewards/${reward.id}`, { method: 'DELETE' })
    setDeleting(false)
    router.refresh()
  }

  return (
    <div className="flex items-start justify-between px-4 py-3 gap-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-900 truncate">{reward.name}</p>
          <Badge variant={reward.is_active ? 'green' : 'gray'}>
            {reward.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </div>
        <p className="text-xs text-brand-600 font-semibold mt-0.5">{reward.points_cost} pts</p>
        {reward.description && <p className="text-xs text-gray-400 truncate">{reward.description}</p>}
        {reward.stock !== null && <p className="text-xs text-gray-400">{reward.stock} in stock</p>}
      </div>
      {canManage && (
        <div className="flex gap-1.5 shrink-0">
          <Button variant="secondary" size="sm" loading={toggling} onClick={toggleActive}>
            {reward.is_active ? 'Deactivate' : 'Activate'}
          </Button>
          <Button variant="danger" size="sm" loading={deleting} onClick={handleDelete}>
            Delete
          </Button>
        </div>
      )}
    </div>
  )
}
