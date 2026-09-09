'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import ConfirmModal from '@/components/ui/ConfirmModal'

interface Props {
  staffId: string
  staffUsername: string
}

/**
 * Human wording per table. Keys are the real table names the database reports,
 * so an unmapped one still reads sensibly rather than breaking the sentence.
 */
const BLOCKING_LABEL: Record<string, string> = {
  point_transactions: 'point entries',
  redemption_requests: 'redemption decisions',
  court_closures: 'court closures',
  cms_posts: 'news posts',
  'billiards.sessions': 'billiards sessions',
  'billiards.stock_movements': 'billiards stock entries',
  'billiards.admins': 'billiards accounts they created',
  'game.sessions': 'game shop sessions',
  'game.staff': 'game shop accounts they created',
}

function describe(table: string): string {
  return BLOCKING_LABEL[table] ?? table.split('.').pop()!.replace(/_/g, ' ')
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
            ([k, n]) => `${n} ${describe(k)}`
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
            {staffUsername} has recorded work
          </p>
          <p className="text-[12.5px] text-amber-800 mt-1 leading-relaxed">
            The account cannot be deleted without taking{' '}
            {blocked.reasons.join(', ')} with it. Removing their access does what you
            want: they can no longer reach any business, and their work stays attached
            to their name in reports and the audit log.
          </p>
          <p className="text-[11.5px] text-amber-700 mt-2 leading-relaxed">
            They will stay on this staff list, showing no access. That is deliberate —
            deleting the row would delete the history.
          </p>
        </div>
        {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex items-center gap-3">
          <Button variant="danger" size="sm" loading={loading} onClick={handleRemoveAccess}>
            Remove all access
          </Button>
          <button
            type="button"
            onClick={() => setBlocked(null)}
            className="text-sm text-gray-500 hover:underline"
          >
            Cancel
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
        title="Remove staff member"
        message={`${staffUsername} will lose access to every business immediately. If they have recorded any work, the account is kept and only their access is removed — you will be asked to confirm that.`}
        confirmLabel="Remove"
        variant="danger"
        isLoading={loading}
      />
    </div>
  )
}
