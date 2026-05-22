'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import PasswordStrengthMeter from '@/components/ui/PasswordStrengthMeter'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function CreateAdminForm() {
  const router = useRouter()
  const { t } = useLanguage()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch('/api/admin/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? t('admin.createAdminFailed'))
      setLoading(false)
      return
    }

    router.push('/admin/staff')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        id="username"
        label={t('admin.usernameLabel')}
        type="text"
        placeholder="e.g. manager, john.doe"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />
      <p className="text-xs text-gray-400 -mt-2">
        {t('admin.usernameHint')}
      </p>
      <Input
        id="password"
        label={t('admin.passwordLabel')}
        type="password"
        placeholder={t('auth.newPasswordPlaceholder')}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <PasswordStrengthMeter password={password} />
      {error && (
        <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}
      <Button type="submit" loading={loading}>{t('admin.createAdminButton')}</Button>
    </form>
  )
}
