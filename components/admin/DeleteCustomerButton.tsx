'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import ConfirmModal from '@/components/ui/ConfirmModal'

interface Props {
  customerId: string
  customerName: string
  customerPhone: string
}

export default function DeleteCustomerButton({ customerId, customerName, customerPhone }: Props) {
  const router = useRouter()
  const { t } = useLanguage()
  const [showConfirm, setShowConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    setDeleting(true)
    setError('')

    const res = await fetch(`/api/customers/${customerId}`, { method: 'DELETE' })

    if (res.ok) {
      setShowConfirm(false)
      router.push('/admin/customers')
      router.refresh()
    } else {
      const json = await res.json()
      setError(json.error ?? t('admin.deleteCustomerFailed'))
      setDeleting(false)
      setShowConfirm(false)
    }
  }

  return (
    <>
      {error && (
        <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg border border-red-200 mb-2">
          {error}
        </p>
      )}
      <button
        onClick={() => setShowConfirm(true)}
        className="text-sm text-red-500 hover:text-red-700 hover:underline transition-colors"
      >
        {t('admin.deleteCustomerLink')}
      </button>

      <ConfirmModal
        isOpen={showConfirm}
        onClose={() => { setShowConfirm(false); setError('') }}
        onConfirm={handleDelete}
        title="Delete account"
        message="This will permanently deactivate this customer's account. All their booking and points history will be preserved."
        confirmLabel={t('admin.deleteCustomerConfirm')}
        variant="danger"
        isLoading={deleting}
      />
    </>
  )
}
