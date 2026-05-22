'use client'

import { useState } from 'react'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import PasswordStrengthMeter, { calcStrength } from '@/components/ui/PasswordStrengthMeter'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface Props {
  customerId: string
  customerName: string
}

export default function ResetPasswordForm({ customerId, customerName }: Props) {
  const { t } = useLanguage()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')

    if (password.length < 8) {
      setMessage(t('auth.passwordTooShort'))
      setStatus('error')
      return
    }
    if (calcStrength(password) < 2) {
      setMessage(t('auth.passwordWeak'))
      setStatus('error')
      return
    }
    if (password !== confirm) {
      setMessage(t('admin.passwordsMismatch'))
      setStatus('error')
      return
    }

    setStatus('loading')
    const res = await fetch(`/api/customers/${customerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    if (res.ok) {
      setStatus('success')
      setMessage(t('admin.customerPasswordResetSuccess', { name: customerName }))
      setPassword('')
      setConfirm('')
    } else {
      const json = await res.json()
      setStatus('error')
      setMessage(json.error ?? t('admin.passwordResetFailed'))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-2">
        <Input
          id="new-password"
          label={t('admin.newPasswordLabel')}
          type="password"
          placeholder={t('auth.newPasswordPlaceholder')}
          value={password}
          onChange={(e) => { setPassword(e.target.value); setStatus('idle'); setMessage('') }}
          autoComplete="new-password"
        />
        <PasswordStrengthMeter password={password} />
      </div>
      <Input
        id="confirm-password"
        label={t('admin.confirmPasswordLabel')}
        type="password"
        placeholder={t('admin.confirmPasswordPlaceholder')}
        value={confirm}
        onChange={(e) => { setConfirm(e.target.value); setStatus('idle'); setMessage('') }}
        autoComplete="new-password"
      />
      {message && (
        <p className={`text-sm px-3 py-2 rounded-lg ${
          status === 'success'
            ? 'text-green-700 bg-green-50'
            : 'text-red-500 bg-red-50'
        }`}>
          {message}
        </p>
      )}
      <Button type="submit" loading={status === 'loading'} className="w-full">
        {t('admin.resetPasswordButton')}
      </Button>
    </form>
  )
}
