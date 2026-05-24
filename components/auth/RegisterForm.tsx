'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { phoneToEmail, normalizePhone } from '@/lib/utils'
import Input from '@/components/ui/Input'
import PasswordInput from '@/components/ui/PasswordInput'
import Button from '@/components/ui/Button'
import { calcStrength } from '@/components/ui/PasswordStrengthMeter'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function RegisterForm() {
  const router = useRouter()
  const { t } = useLanguage()
  const [phone, setPhone] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const normalized = normalizePhone(phone)
    if (!/^09\d{7,9}$/.test(normalized)) {
      setError(t('auth.invalidPhone'))
      return
    }
    if (password.length < 8) {
      setError(t('auth.passwordTooShort'))
      return
    }
    if (calcStrength(password) < 2) {
      setError(t('auth.passwordWeak'))
      return
    }

    setLoading(true)

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: normalized, username: username.trim(), password }),
    })

    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? t('auth.registrationFailed'))
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: phoneToEmail(normalized),
      password,
    })

    if (signInError) {
      setError(t('auth.accountCreated'))
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        id="phone"
        label={t('auth.phone')}
        type="tel"
        placeholder={t('auth.phonePlaceholder')}
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        required
        autoComplete="tel"
      />
      <Input
        id="username"
        label={t('auth.username')}
        type="text"
        placeholder={t('auth.usernamePlaceholder')}
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
        autoComplete="username"
        minLength={2}
        maxLength={50}
      />
      <PasswordInput
        id="password"
        label={t('auth.password')}
        placeholder={t('auth.newPasswordPlaceholder')}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete="new-password"
        minLength={8}
        showStrength
      />
      {error && (
        <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}
      <Button type="submit" size="lg" loading={loading}>
        {t('auth.createAccount')}
      </Button>
    </form>
  )
}
