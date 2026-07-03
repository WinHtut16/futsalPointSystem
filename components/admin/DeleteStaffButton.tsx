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

export default function DeleteStaffButton({ staffId, staffUsername }: Props) {
  const router = useRouter()
  const { t } = useLanguage()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)

  async function handleDelete() {
    setShowConfirm(false)
    setError('')
    setLoading(true)

    const res = await fetch(`/api/admin/staff/${staffId}`, { method: 'DELETE' })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? t('admin.deleteAdminFailed'))
      setLoading(false)
      return
    }

    router.push('/admin/staff')
    router.refresh()
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-500">
        {t('admin.deleteAdminNote')}
      </p>
      {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      <Button variant="danger" size="sm" loading={loading} onClick={() => setShowConfirm(true)}>
        {t('admin.deleteAdminButton')}
      </Button>

      <ConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleDelete}
        title="Remove staff member"
        message="This person will lose access to the admin panel immediately."
        confirmLabel="Remove"
        variant="danger"
        isLoading={loading}
      />
    </div>
  )
}
