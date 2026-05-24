'use client'

import { useState } from 'react'
import PasswordInput from '@/components/ui/PasswordInput'
import Button from '@/components/ui/Button'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface Props {
  staffId: string
  staffUsername: string
}

export default function StaffResetPasswordForm({ staffId, staffUsername }: Props) {
  const { t } = useLanguage()
  const [password, setPassword] = useState('')
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess(false)
    setLoading(true)

    const res = await fetch(`/api/admin/staff/${staffId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? t('admin.passwordResetFailed'))
    } else {
      setSuccess(true)
      setPassword('')
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-sm text-gray-500">{t('admin.staffPasswordNote', { name: staffUsername })}</p>
      <PasswordInput
        id="staff-password"
        label={t('admin.newPasswordLabel')}
        placeholder={t('auth.newPasswordPlaceholder')}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        showStrength
      />
      {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      {success && <p className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg">{t('admin.staffPasswordResetSuccess')}</p>}
      <Button type="submit" size="sm" loading={loading}>{t('admin.resetPasswordButton')}</Button>
    </form>
  )
}
