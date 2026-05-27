'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
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
    router.push(isAdmin ? '/admin/dashboard' : next ?? '/dashboard')
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
      <Button type="submit" size="lg" loading={loading}>
        {t('auth.signIn')}
      </Button>
      <p className="text-center text-sm text-gray-500">
        {t('auth.noAccount')}{' '}
        <Link href="/register" className="text-brand-600 font-medium hover:underline">
          {t('auth.register')}
        </Link>
      </p>
    </form>
  )
}
