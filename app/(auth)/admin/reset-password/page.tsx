'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import PasswordInput from '@/components/ui/PasswordInput'
import Button from '@/components/ui/Button'
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
    // /auth/callback redirects here with ?error=link_expired when the token exchange
    // fails (cross-device click, expired PKCE code, email prefetch consuming the token).
    // Reading via window.location avoids adding useSearchParams + a Suspense boundary.
    const params = new URLSearchParams(window.location.search)
    if (params.get('error') === 'link_expired') {
      setError(t('auth.invalidResetLink'))
      return
    }
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
    <main
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10"
      style={{ background: 'linear-gradient(160deg, var(--color-primary), var(--color-primary-dark))' }}
    >
      <svg viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" className="pointer-events-none absolute inset-0 h-full w-full" style={{ opacity: 0.07 }} aria-hidden="true">
        <g stroke="#fff" strokeWidth="2" fill="none">
          <rect x="20" y="20" width="360" height="560" />
          <line x1="20" y1="300" x2="380" y2="300" />
          <circle cx="200" cy="300" r="60" />
          <circle cx="200" cy="300" r="3" fill="#fff" />
          <rect x="120" y="20" width="160" height="80" />
          <rect x="120" y="500" width="160" height="80" />
          <rect x="165" y="20" width="70" height="30" />
          <rect x="165" y="550" width="70" height="30" />
        </g>
      </svg>
      <div className="absolute right-4 top-4 z-10">
        <LanguageToggle variant="light" />
      </div>
      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="mb-3 flex items-center justify-center" style={{ width: 84, height: 84, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)', borderRadius: 20 }}>
            <Image src="/logo_black.jpg" alt="Mya Thida Futsal" width={928} height={844} className="rounded-xl object-contain" style={{ width: 52, height: 52 }} />
          </div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-white">{t('auth.adminResetPasswordTitle')}</h1>
        </div>
        <div className="bg-white p-6" style={{ borderRadius: 'var(--r-2xl)', boxShadow: 'var(--shadow-lg)' }}>
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
              <PasswordInput
                id="password"
                label={t('admin.newPasswordLabel')}
                placeholder={t('auth.newPasswordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                showStrength
              />
              <PasswordInput
                id="confirm"
                label={t('admin.confirmPasswordLabel')}
                placeholder={t('auth.repeatPasswordPlaceholder')}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
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
