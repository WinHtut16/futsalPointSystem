'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { phoneToEmail, normalizePhone, safeRedirect } from '@/lib/utils'
import Input from '@/components/ui/Input'
import PasswordInput from '@/components/ui/PasswordInput'
import Button from '@/components/ui/Button'
import { calcStrength } from '@/components/ui/PasswordStrengthMeter'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { fetchWithTimeout, isTimeoutOrNetworkError, REGISTER_POST_TIMEOUT_MS } from '@/lib/fetchWithTimeout'


export default function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useLanguage()
  const [phone, setPhone] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [alreadyRegistered, setAlreadyRegistered] = useState(false)
  const [loading, setLoading] = useState(false)

  async function postRegister(normalized: string) {
    return fetchWithTimeout(
      '/api/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalized, username: username.trim(), password }),
      },
      REGISTER_POST_TIMEOUT_MS
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setAlreadyRegistered(false)

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

    let res: Response
    try {
      res = await postRegister(normalized)
      // A Vercel function timeout surfaces as a real 5xx, not necessarily a thrown
      // abort — treat it the same as a network failure and retry once, same as below.
      if (res.status >= 500) throw new Error('server timeout')
    } catch (err) {
      if (!isTimeoutOrNetworkError(err) && !(err instanceof Error && err.message === 'server timeout')) {
        setError(t('auth.registrationFailed'))
        setLoading(false)
        return
      }
      try {
        // Safe to retry: POST /api/auth/register is idempotent. If the first
        // attempt actually succeeded server-side but its response was lost on the
        // way back, the retry authenticates that same account and returns success
        // — it no longer degrades into a spurious "already registered" error.
        res = await postRegister(normalized)
      } catch {
        setError(t('auth.connectionIssue'))
        setLoading(false)
        return
      }
    }

    const json = await res.json().catch(() => ({}))

    if (res.status === 409) {
      // Authoritative now. The server already tested the submitted password against
      // the existing account; a 409 means it did not match, so this number really
      // does belong to somebody else. No client-side sign-in attempt to make here,
      // which also removes a 15-30s dead wait from the failure path.
      setAlreadyRegistered(true)
      setError(t('auth.alreadyRegisteredSignIn'))
      setLoading(false)
      return
    }

    if (!res.ok) {
      setError(json.error ?? t('auth.registrationFailed'))
      setLoading(false)
      return
    }

    // Normal path: the server signed this account in and attached the session
    // cookies to the response we just read. The browser is already logged in —
    // no second round trip to *.supabase.co, which is the whole point.
    if (json.session) {
      router.push(safeRedirect(searchParams.get('next'), '/account'))
      router.refresh()
      return
    }

    // Rare: account exists but the server-side sign-in did not stick. Fall back to
    // signing in from the browser (also covers a client running against an older
    // deployment that does not send `session`).
    const supabase = createClient()
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: phoneToEmail(normalized),
        password,
      })
      if (signInError) {
        setError(isTimeoutOrNetworkError(signInError) ? t('auth.connectionIssue') : t('auth.accountCreated'))
        setLoading(false)
        return
      }
    } catch (err) {
      setError(isTimeoutOrNetworkError(err) ? t('auth.connectionIssue') : t('auth.accountCreated'))
      setLoading(false)
      return
    }

    router.push(safeRedirect(searchParams.get('next'), '/account'))
    router.refresh()
  }

  return (
    // noValidate: without this, the browser's own built-in validation (from the
    // `required`/`minLength` attributes below) silently blocks the submit and shows
    // its own popup before handleSubmit ever runs — our translated, styled error
    // messages below never render. All validation already happens in handleSubmit.
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
        <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">
          {error}
          {alreadyRegistered && (
            <>
              {' '}
              <Link href="/login" className="underline font-medium">
                {t('auth.signInLink')}
              </Link>
            </>
          )}
        </p>
      )}
      <Button type="submit" size="lg" loading={loading} className="!bg-primary hover:!bg-primary-dark">
        {t('auth.createAccount')}
      </Button>
    </form>
  )
}
