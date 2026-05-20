'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'

interface Props {
  customerId: string
  customerName: string
  customerPhone: string
}

export default function DeleteCustomerButton({ customerId, customerName, customerPhone }: Props) {
  const router = useRouter()
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
      setError(json.error ?? 'Failed to delete customer.')
      setStep('confirm')
    }
  }

  if (step === 'idle') {
    return (
      <button
        onClick={() => setStep('confirm')}
        className="text-sm text-red-500 hover:text-red-700 hover:underline transition-colors"
      >
        Delete this customer
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
      <div>
        <p className="font-semibold text-red-700">Delete Customer Account</p>
        <p className="text-sm text-red-600 mt-1">
          This will permanently delete <span className="font-bold">{customerName}</span> ({customerPhone}) and all their transaction history. This action cannot be undone.
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
          Cancel
        </button>
        <Button
          onClick={handleDelete}
          loading={step === 'deleting'}
          variant="danger"
          className="flex-1"
        >
          Yes, Delete Permanently
        </Button>
      </div>
    </div>
  )
}
