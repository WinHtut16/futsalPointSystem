'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Reward } from '@/types'
import Badge from '@/components/ui/Badge'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { getLocalizedText } from '@/lib/i18n/utils'
import { cn } from '@/lib/utils'

interface RewardAdminRowProps {
  reward: Reward
  canToggle: boolean
  canManage: boolean
}

function SpinnerIcon() {
  return (
    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  )
}

function PowerIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.636 5.636a9 9 0 1012.728 0M12 3v9" />
    </svg>
  )
}

interface IconButtonProps {
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  title: string
  colorClass: string
  children: React.ReactNode
}

function IconButton({ onClick, disabled, loading, title, colorClass, children }: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      className={cn(
        'inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed',
        colorClass
      )}
    >
      {loading ? <SpinnerIcon /> : children}
    </button>
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
    <div className="flex items-start justify-between px-4 py-3 gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
          <Badge variant={reward.is_active ? 'green' : 'gray'}>
            {reward.is_active ? t('admin.active') : t('admin.inactive')}
          </Badge>
        </div>
        <p className="text-xs text-brand-600 font-semibold mt-0.5">{reward.points_cost} {t('common.pts')}</p>
        {reward.description && <p className="text-xs text-gray-400 truncate">{reward.description}</p>}
        {reward.stock !== null && <p className="text-xs text-gray-400">{reward.stock} {t('admin.inStock')}</p>}
      </div>
      {(canToggle || canManage) && (
        <div className="flex items-center gap-1 shrink-0 pt-0.5">
          {canToggle && (
            <IconButton
              onClick={toggleActive}
              loading={toggling}
              title={reward.is_active ? t('admin.deactivate') : t('admin.activate')}
              colorClass={reward.is_active
                ? 'text-orange-500 hover:bg-orange-50 focus:ring-orange-400'
                : 'text-green-600 hover:bg-green-50 focus:ring-green-400'}
            >
              <PowerIcon />
            </IconButton>
          )}
          {canManage && (
            <IconButton
              onClick={() => router.push(`/admin/rewards/${reward.id}/edit`)}
              title={t('admin.editReward')}
              colorClass="text-blue-600 hover:bg-blue-50 focus:ring-blue-400"
            >
              <PencilIcon />
            </IconButton>
          )}
          {canManage && (
            <IconButton
              onClick={handleDelete}
              loading={deleting}
              title={t('admin.deleteReward')}
              colorClass="text-red-600 hover:bg-red-50 focus:ring-red-400"
            >
              <TrashIcon />
            </IconButton>
          )}
        </div>
      )}
    </div>
  )
}
