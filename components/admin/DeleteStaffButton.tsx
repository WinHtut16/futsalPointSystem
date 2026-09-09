'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { TranslationKey } from '@/lib/i18n'
import ConfirmModal from '@/components/ui/ConfirmModal'

interface Props {
  staffId: string
  staffUsername: string
}

/**
 * Tables the database can name as blocking a delete. Each has a translated
 * phrase under `admin.deleteStaffReason.<table>`; an unmapped one still reads
 * sensibly from the cleaned table name rather than breaking the sentence.
 */
const KNOWN_REASON_TABLES = new Set<string>([
  'point_transactions',
  'redemption_requests',
  'court_closures',
  'cms_posts',
  'billiards.sessions',
  'billiards.stock_movements',
  'billiards.admins',
  'game.sessions',
  'game.staff',
])

function describe(table: string, t: (k: TranslationKey) => string): string {
  if (KNOWN_REASON_TABLES.has(table)) {
    return t(`admin.deleteStaffReason.${table}` as TranslationKey)
  }
  return table.split('.').pop()!.replace(/_/g, ' ')
}

export default function DeleteStaffButton({ staffId, staffUsername }: Props) {
  const router = useRouter()
  const { t } = useLanguage()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  /**
   * Set when the database refuses the delete because the person has recorded
   * work. Not an error state - it is the normal outcome for anyone who has
   * worked a shift, and it offers the removal that does work rather than
   * leaving the superadmin at a dead end.
   */
  const [blocked, setBlocked] = useState<{ reasons: string[] } | null>(null)

  async function handleDelete() {
    setShowConfirm(false)
    setError('')
    setBlocked(null)
    setLoading(true)

    const res = await fetch(`/api/admin/staff/${staffId}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      if (data?.canRemoveAccessInstead) {
        const counts = (data.blocking ?? {}) as Record<string, number>
        setBlocked({
          reasons: Object.entries(counts).map(
            ([k, n]) => `${n} ${describe(k, t)}`
          ),
        })
      } else {
        setError(data?.error ?? t('admin.deleteAdminFailed'))
      }
      setLoading(false)
      return
    }

    router.push('/admin/staff')
    router.refresh()
  }

  async function handleRemoveAccess() {
    setError('')
    setLoading(true)

    const res = await fetch(`/api/admin/staff/${staffId}/remove-access`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      setError(data?.error ?? t('admin.deleteAdminFailed'))
      setLoading(false)
      return
    }

    setBlocked(null)
    setLoading(false)
    router.refresh()
  }

  if (blocked) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900">
            {t('admin.deleteStaffBlockedTitle', { name: staffUsername })}
          </p>
          <p className="text-[12.5px] text-amber-800 mt-1 leading-relaxed">
            {t('admin.deleteStaffBlockedBody', { reasons: blocked.reasons.join(', ') })}
          </p>
          <p className="text-[11.5px] text-amber-700 mt-2 leading-relaxed">
            {t('admin.deleteStaffBlockedNote')}
          </p>
        </div>
        {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex items-center gap-3">
          <Button variant="danger" size="sm" loading={loading} onClick={handleRemoveAccess}>
            {t('admin.deleteStaffRemoveAccess')}
          </Button>
          <button
            type="button"
            onClick={() => setBlocked(null)}
            className="text-sm text-gray-500 hover:underline"
          >
            {t('admin.deleteStaffCancel')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-500">{t('admin.deleteAdminNote')}</p>
      {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      <Button variant="danger" size="sm" loading={loading} onClick={() => setShowConfirm(true)}>
        {t('admin.deleteAdminButton')}
      </Button>

      <ConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleDelete}
        title={t('admin.deleteStaffConfirmTitle')}
        message={t('admin.deleteStaffConfirmMsg', { name: staffUsername })}
        confirmLabel={t('admin.deleteStaffConfirmCta')}
        cancelLabel={t('admin.deleteStaffCancel')}
        variant="danger"
        isLoading={loading}
      />
    </div>
  )
}
