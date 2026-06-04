'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Calendar } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { phoneToEmail, safeRedirect } from '@/lib/utils'
import Input from '@/components/ui/Input'
import PasswordInput from '@/components/ui/PasswordInput'
import Button from '@/components/ui/Button'
import { useLanguage } from '@/lib/i18n/LanguageContext'


export default function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useLanguage()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
    router.push(isAdmin ? '/admin/dashboard' : safeRedirect(searchParams.get('next'), '/account'))
    router.refresh()
  }

  const nextParam = searchParams.get('next')
  const bookingReturn = !!nextParam && nextParam.includes('/book/confirm')

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
      <PasswordInput
        id="password"
        label={t('auth.password')}
        placeholder={t('auth.passwordPlaceholder')}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete="current-password"
      />
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
