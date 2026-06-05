'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2, Zap, ToggleLeft, ToggleRight } from 'lucide-react'
import type { Reward } from '@/types'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { getLocalizedText } from '@/lib/i18n/utils'
import { cn } from '@/lib/utils'

interface RewardAdminRowProps {
  reward: Reward
  canToggle: boolean
  canManage: boolean
}

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}

export default function RewardAdminRow({ reward, canToggle, canManage }: RewardAdminRowProps) {
  const router = useRouter()
  const { t, lang } = useLanguage()
  const displayName = getLocalizedText(reward.name, reward.name_my, lang)
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
    if (!confirm(t('admin.confirmDelete').replace('{name}', reward.name))) return
    setDeleting(true)
    const res = await fetch(`/api/rewards/${reward.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      alert(body.error ?? 'Failed to delete reward')
      return
    }
    router.refresh()
  }

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-4 transition-colors',
        !reward.is_active && 'opacity-60',
      )}
    >
      {/* Icon */}
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
        <Zap className="w-5 h-5 text-primary" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-900">{displayName}</p>
          <span
            className={cn(
              'inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded-full',
              reward.is_active
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-gray-100 text-gray-500',
            )}
          >
            {reward.is_active ? t('admin.active') : t('admin.inactive')}
          </span>
        </div>
        {reward.description && (
          <p className="text-xs text-gray-400 truncate mt-0.5">{reward.description}</p>
        )}
        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-sm font-bold text-brand-600">
            {reward.points_cost.toLocaleString()} {t('common.pts')}
          </span>
          {reward.stock !== null && (
            <span className="text-xs text-gray-400">
              {reward.stock} {t('admin.inStock')}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      {(canToggle || canManage) && (
        <div className="flex items-center gap-1 shrink-0 pt-0.5">
          {canToggle && (
            <button
              onClick={toggleActive}
              disabled={toggling || deleting}
              title={reward.is_active ? t('admin.deactivate') : t('admin.activate')}
              className={cn(
                'inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed',
                reward.is_active
                  ? 'text-orange-500 hover:bg-orange-50'
                  : 'text-emerald-600 hover:bg-emerald-50',
              )}
            >
              {toggling ? (
                <Spinner />
              ) : reward.is_active ? (
                <ToggleRight className="w-4 h-4" />
              ) : (
                <ToggleLeft className="w-4 h-4" />
              )}
            </button>
          )}
          {canManage && (
            <button
              onClick={() => router.push(`/admin/rewards/${reward.id}/edit`)}
              disabled={toggling || deleting}
              title={t('admin.editReward')}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          {canManage && (
            <button
              onClick={handleDelete}
              disabled={toggling || deleting}
              title={t('admin.deleteReward')}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-red-500 hover:bg-red-50 transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleting ? <Spinner /> : <Trash2 className="w-4 h-4" />}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
