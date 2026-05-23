'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import PasswordStrengthMeter from '@/components/ui/PasswordStrengthMeter'
import LanguageToggle from '@/components/ui/LanguageToggle'

export default function AdminResetPasswordPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
      else setError(t('auth.invalidResetLink'))
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError(t('admin.passwordsMismatch')); return }
    if (password.length < 8) { setError(t('auth.passwordTooShort')); return }
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) { setError(updateError.message); setLoading(false); return }
    // Revoke all sessions globally so the old session can't be reused
    await supabase.auth.signOut({ scope: 'global' })
    setSuccess(true)
    setTimeout(() => router.push('/admin/login'), 2000)
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-800 to-gray-900 flex flex-col items-center justify-center px-4">
      <div className="absolute top-4 right-4">
        <LanguageToggle variant="dark" />
      </div>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo_black.jpg" alt="Mya Thida" className="w-28 h-28 rounded-2xl object-contain shadow-2xl" />
          </div>
          <h1 className="text-2xl font-bold text-white">{t('auth.adminResetPasswordTitle')}</h1>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-6">
          {success ? (
            <div className="text-center py-2 space-y-2">
              <p className="text-green-600 font-semibold">{t('auth.passwordUpdated')}</p>
              <p className="text-sm text-gray-500">{t('auth.redirectingToLogin')}</p>
            </div>
          ) : !ready && !error ? (
            <p className="text-center text-sm text-gray-400 py-4">{t('auth.verifyingLink')}</p>
          ) : !ready && error ? (
            <div className="text-center space-y-3 py-2">
              <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              <Link href="/admin/forgot-password" className="text-sm text-brand-600 hover:underline">
                {t('auth.requestNewLink')}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Input
                  id="password"
                  label={t('admin.newPasswordLabel')}
                  type="password"
                  placeholder={t('auth.newPasswordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  showPasswordToggle
                />
                <PasswordStrengthMeter password={password} />
              </div>
              <Input
                id="confirm"
                label={t('admin.confirmPasswordLabel')}
                type="password"
                placeholder={t('auth.repeatPasswordPlaceholder')}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                showPasswordToggle
              />
              {error && (
                <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}
              <Button type="submit" size="lg" loading={loading}>
                {t('auth.setNewPassword')}
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
