'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface Props {
  customerId: string
  customerName: string
  customerPhone: string
}

export default function DeleteCustomerButton({ customerId, customerName, customerPhone }: Props) {
  const router = useRouter()
  const { t } = useLanguage()
  const [step, setStep] = useState<'idle' | 'confirm' | 'deleting'>('idle')
  const [error, setError] = useState('')

  async function handleDelete() {
    setStep('deleting')
    setError('')

    const res = await fetch(`/api/customers/${customerId}`, { method: 'DELETE' })

    if (res.ok) {
      router.push('/admin/customers')
      router.refresh()
    } else {
      const json = await res.json()
      setError(json.error ?? t('admin.deleteCustomerFailed'))
      setStep('confirm')
    }
  }

  if (step === 'idle') {
    return (
      <button
        onClick={() => setStep('confirm')}
        className="text-sm text-red-500 hover:text-red-700 hover:underline transition-colors"
      >
        {t('admin.deleteCustomerLink')}
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
      <div>
        <p className="font-semibold text-red-700">{t('admin.deleteCustomerTitle')}</p>
        <p className="text-sm text-red-600 mt-1">
          {t('admin.deleteCustomerWarning', { name: customerName, phone: customerPhone })}
        </p>
      </div>
      {error && (
        <p className="text-sm text-red-500 bg-white px-3 py-2 rounded-lg border border-red-200">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <button
          onClick={() => { setStep('idle'); setError('') }}
          disabled={step === 'deleting'}
          className="flex-1 text-sm py-2 px-4 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          {t('common.cancel')}
        </button>
        <Button
          onClick={handleDelete}
          loading={step === 'deleting'}
          variant="danger"
          className="flex-1"
        >
          {t('admin.deleteCustomerConfirm')}
        </Button>
      </div>
    </div>
  )
}
