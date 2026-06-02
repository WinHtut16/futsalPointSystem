'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Calendar, Mail, Phone, MessageCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { phoneToEmail } from '@/lib/utils'
import Input from '@/components/ui/Input'
import PasswordInput from '@/components/ui/PasswordInput'
import Button from '@/components/ui/Button'
import { useLanguage } from '@/lib/i18n/LanguageContext'

// Only allow same-origin relative redirects (block //host and \ bypasses).
function safeNext(next: string | null): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return null
  return next
}

export default function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useLanguage()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Forgot password state
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSent, setForgotSent] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: phoneToEmail(phone),
      password,
    })

    if (authError) {
      const msg = authError.message.toLowerCase()
      setError(
        msg.includes('rate limit') || msg.includes('too many')
          ? t('auth.tooManyAttempts')
          : t('auth.invalidCredentials')
      )
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user!.id)
      .single()

    const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin'
    const next = safeNext(searchParams.get('next'))
    router.push(isAdmin ? '/admin/dashboard' : next ?? '/account')
    router.refresh()
  }

  async function handleForgotSubmit(e: React.FormEvent) {
    e.preventDefault()
    setForgotLoading(true)
    const supabase = createClient()
    // Ensure NEXT_PUBLIC_SITE_URL is set correctly in Vercel environment variables for each deployment
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin
    await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
    })
    // Always show success — Supabase intentionally gives vague response for security
    setForgotSent(true)
    setForgotLoading(false)
  }

  const nextParam = searchParams.get('next')
  const bookingReturn = !!nextParam && nextParam.includes('/book/confirm')

  if (showForgot) {
    return (
      <div className="space-y-5">
        {/* Option A — Reset by email */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
            {t('auth.resetByEmail')}
          </p>
          {forgotSent ? (
            <div className="rounded-xl bg-green-50 px-4 py-3">
              <p className="text-sm text-green-700">{t('auth.resetLinkSent')}</p>
            </div>
          ) : (
            <form onSubmit={handleForgotSubmit} className="space-y-2">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <Mail size={15} />
                </span>
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder={t('auth.enterEmailForReset')}
                  className="w-full rounded-xl border border-line bg-white py-2.5 pl-9 pr-3 text-sm text-ink-primary placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  autoComplete="email"
                />
              </div>
              <button
                type="submit"
                disabled={forgotLoading}
                className="w-full rounded-xl border border-primary px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/5 disabled:opacity-50"
              >
                {forgotLoading ? '...' : t('auth.sendResetLink')}
              </button>
            </form>
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-line" />
          <span className="text-xs text-gray-400">or</span>
          <div className="h-px flex-1 bg-line" />
        </div>

        {/* Option B — Contact admin */}
        <div>
          <p className="text-sm text-gray-600 mb-3">{t('auth.noEmailSaved')}</p>
          <div className="flex gap-2">
            <a
              href="tel:+959797272000"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-line bg-gray-50 px-3 py-2.5 text-sm font-medium text-ink-primary transition-colors hover:bg-gray-100"
            >
              <Phone size={15} className="text-gray-500" />
              <span>+95 9 797 272000</span>
            </a>
            <a
              href="viber://chat?number=%2B959797272000"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-line bg-gray-50 px-3 py-2.5 text-sm font-medium text-ink-primary transition-colors hover:bg-gray-100"
            >
              <MessageCircle size={15} className="text-purple-500" />
              <span>Viber</span>
            </a>
          </div>
          <p className="mt-2 text-xs text-gray-400">{t('auth.tempPasswordNote')}</p>
        </div>

        {/* Back to login */}
        <button
          type="button"
          onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail('') }}
          className="w-full text-center text-sm text-primary hover:underline"
        >
          {t('auth.backToLogin')}
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {bookingReturn && (
        <div className="flex items-center gap-2.5 rounded-xl bg-primary-soft px-3 py-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-primary">
            <Calendar size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[12.5px] font-semibold text-ink-primary">{t('booking.login.bookingHeld')}</p>
            <p className="text-[11px] text-ink-muted">{t('booking.login.bringBack')}</p>
          </div>
        </div>
      )}
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
      <div>
        <PasswordInput
          id="password"
          label={t('auth.password')}
          placeholder={t('auth.passwordPlaceholder')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        <button
          type="button"
          onClick={() => setShowForgot(true)}
          className="mt-1.5 text-xs hover:underline hover:opacity-80"
          style={{ color: 'var(--color-slot-pending)' }}
        >
          {t('auth.forgotPassword')}
        </button>
      </div>
      {error && (
        <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}
      <Button type="submit" size="lg" loading={loading} className="!bg-primary hover:!bg-primary-dark">
        {t('auth.signIn')}
      </Button>
      <p className="text-center text-sm text-ink-muted">
        {t('auth.noAccount')}{' '}
        <Link
          href={searchParams.get('next') ? `/register?next=${encodeURIComponent(searchParams.get('next')!)}` : '/register'}
          className="text-primary font-medium hover:underline"
        >
          {t('auth.register')}
        </Link>
      </p>
    </form>
  )
}