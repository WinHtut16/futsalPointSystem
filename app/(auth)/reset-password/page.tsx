'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import PasswordInput from '@/components/ui/PasswordInput'
import Button from '@/components/ui/Button'
import AuthShell from '@/components/auth/AuthShell'

export default function CustomerResetPasswordPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('error') === 'link_expired') {
      setError(t('auth.resetLinkExpired'))
      return
    }
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
      else setError(t('auth.resetLinkExpired'))
    })
  }, [])

  const mismatch = confirm.length > 0 && password.length > 0 && confirm !== password

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setError(t('auth.passwordTooShort')); return }
    if (password !== confirm) { setError(t('auth.passwordMismatch')); return }
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) { setError(updateError.message); setLoading(false); return }
    setSuccess(true)
    setTimeout(() => router.push('/account'), 2000)
  }

  const formContent = success ? (
    <div className="space-y-2 py-2 text-center">
      <p className="font-semibold text-green-600">{t('auth.passwordResetSuccess')}</p>
      <p className="text-sm text-gray-500">{t('auth.redirectingToLogin')}</p>
    </div>
  ) : !ready && !error ? (
    <p className="py-4 text-center text-sm text-gray-400">{t('auth.verifyingLink')}</p>
  ) : !ready && error ? (
    <div className="space-y-3 py-2 text-center">
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-500">{error}</p>
      <Link href="/login" className="text-sm text-primary hover:underline">
        {t('auth.backToLogin')}
      </Link>
    </div>
  ) : (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PasswordInput
        id="new-password"
        label={t('auth.newPassword')}
        placeholder={t('auth.newPasswordPlaceholder')}
        value={password}
        onChange={(e) => { setPassword(e.target.value); setError('') }}
        required
        showStrength
        autoComplete="new-password"
      />
      <PasswordInput
        id="confirm-password"
        label={t('auth.confirmPassword')}
        placeholder={t('auth.newPasswordPlaceholder')}
        value={confirm}
        onChange={(e) => { setConfirm(e.target.value); setError('') }}
        error={mismatch ? t('auth.passwordMismatch') : undefined}
        required
        autoComplete="new-password"
      />
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-500">{error}</p>
      )}
      <Button type="submit" size="lg" loading={loading} className="!bg-primary hover:!bg-primary-dark">
        {t('auth.setNewPassword')}
      </Button>
    </form>
  )

  return (
    <AuthShell
      heading="Mya Thida"
      tagline={t('auth.setNewPasswordSub')}
    >
      {formContent}
    </AuthShell>
  )
}