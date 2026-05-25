'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface AdjustPointsFormProps {
  customerId: string
  customerName: string
}

export default function AdjustPointsForm({ customerId, customerName }: AdjustPointsFormProps) {
  const router = useRouter()
  const { t } = useLanguage()
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const parsedAmount = amount === '' ? NaN : parseInt(amount, 10)
  const validAmount = Number.isInteger(parsedAmount) && parsedAmount !== 0
  const isPositive = parsedAmount > 0
  const isNegative = parsedAmount < 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!validAmount) {
      setError(t('admin.adjustInvalidAmount'))
      return
    }

    setLoading(true)
    const res = await fetch('/api/points/adjust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: customerId,
        points_delta: parsedAmount,
        reason: reason.trim(),
      }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error ?? t('admin.adjustFailed'))
      return
    }

    const sign = parsedAmount > 0 ? '+' : ''
    setSuccess(t('admin.adjustSuccess', { name: customerName, points: `${sign}${parsedAmount}` }))
    setAmount('')
    setReason('')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        id="adjust-amount"
        label={t('admin.adjustAmountLabel')}
        type="number"
        step="1"
        placeholder={t('admin.adjustAmountPlaceholder')}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
      />

      {validAmount && (
        <p
          className={`text-sm font-medium px-3 py-2 rounded-lg ${
            isPositive
              ? 'bg-green-50 text-green-700'
              : isNegative
                ? 'bg-red-50 text-red-700'
                : ''
          }`}
        >
          {isPositive
            ? t('admin.adjustPreviewAdd', { points: parsedAmount })
            : t('admin.adjustPreviewDeduct', { points: Math.abs(parsedAmount) })}
        </p>
      )}

      <Input
        id="adjust-reason"
        label={t('admin.adjustReasonLabel')}
        type="text"
        placeholder={t('admin.adjustReasonPlaceholder')}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={500}
        required
      />

      {error && <p className="text-sm text-red-500">{error}</p>}
      {success && <p className="text-sm text-green-600 font-medium">{success}</p>}

      <Button type="submit" size="lg" loading={loading} variant="secondary">
        {t('admin.adjustButton')}
      </Button>
    </form>
  )
}
