'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { X, ArrowRight, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { phoneToEmail } from '@/lib/utils'
import Input from '@/components/ui/Input'
import PasswordInput from '@/components/ui/PasswordInput'
import Button from '@/components/ui/Button'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface BookingLoginSheetProps {
  open: boolean
  onClose: () => void
  // Called after a successful CUSTOMER sign-in. Cart stays in the parent's
  // React state, so no navigation happens — the page just unlocks.
  onSuccess: (name: string) => void
  // Where an admin who logs in here should land, and the register fallback target.
  nextTarget: string
}

export default function BookingLoginSheet({ open, onClose, onSuccess, nextTarget }: BookingLoginSheetProps) {
  const { t, lang } = useLanguage()
  const my = lang === 'my' ? 'my' : ''
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Drag-to-dismiss refs
  const dragStartY = useRef<number | null>(null)
  const dragDelta = useRef<number>(0)

  const handleDragStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY
    dragDelta.current = 0
  }

  const handleDragMove = (e: React.TouchEvent) => {
    if (dragStartY.current === null) return
    const scrollContainer = e.currentTarget as HTMLElement
    if (scrollContainer.scrollTop > 0) {
      dragStartY.current = null
      return
    }
    const delta = e.touches[0].clientY - dragStartY.current
    if (delta > 0) dragDelta.current = delta
  }

  const handleDragEnd = () => {
    if (dragDelta.current >= 80) onClose()
    dragStartY.current = null
    dragDelta.current = 0
  }

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
      setError(msg.includes('rate limit') || msg.includes('too many') ? t('auth.tooManyAttempts') : t('auth.invalidCredentials'))
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, username')
      .eq('id', user!.id)
      .single()

    // Admins don't book — fall back to a full navigation to their dashboard.
    if (profile?.role === 'admin' || profile?.role === 'superadmin') {
      window.location.href = '/admin/dashboard'
      return
    }

    onSuccess(profile?.username ?? 'Member')
  }

  return (
    <div
      className={`fixed inset-0 z-40 md:hidden transition-opacity duration-300
                  ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
    >
      {/* scrim */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className={`absolute inset-0 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
        style={{ background: 'rgba(15,30,22,0.55)', cursor: 'pointer' }}
      />

      {/* sheet */}
      <div
        className={`absolute inset-x-0 bottom-0 bg-surface px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-2.5
                    max-h-[85vh] overflow-y-auto
                    transition-transform duration-300 ease-out
                    ${open ? 'translate-y-0' : 'translate-y-full'}`}
        style={{
          borderTopLeftRadius: 'var(--r-2xl)',
          borderTopRightRadius: 'var(--r-2xl)',
          boxShadow: '0 -16px 48px -12px rgba(15,40,28,0.4)',
        }}
        onTouchStart={handleDragStart}
        onTouchMove={handleDragMove}
        onTouchEnd={handleDragEnd}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line-strong" />

        <div className="mb-1 flex items-center justify-between">
          <div className={`font-display text-[21px] font-extrabold tracking-tight text-ink-primary ${my}`}>
            {t('booking.login.title')}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface text-ink-muted"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className={`mb-4 text-[12.5px] text-ink-muted ${my}`}>{t('booking.login.slotsSaved')}</div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            id="sheet-phone"
            label={t('auth.phone')}
            type="tel"
            placeholder={t('auth.phonePlaceholder')}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            autoComplete="tel"
          />
          <PasswordInput
            id="sheet-password"
            label={t('auth.password')}
            placeholder={t('auth.passwordPlaceholder')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-500">{error}</p>}
          <Button type="submit" size="lg" loading={loading}>
            <span className={my}>{t('booking.login.signInContinue')}</span>
            <ArrowRight size={15} />
          </Button>
        </form>

        <div className="mt-4 text-center">
          <span className={`text-[12.5px] text-ink-muted ${my}`}>
            {t('auth.noAccount')}{' '}
            <Link href={`/register?next=${encodeURIComponent(nextTarget)}`} className="font-bold text-primary">
              {t('auth.register')}
            </Link>
          </span>
        </div>

        <div className={`mt-4 flex items-center gap-2 rounded-lg bg-primary-soft px-3 py-2.5 text-[11.5px] text-ink ${my}`}>
          <Lock size={13} className="shrink-0 text-primary" />
          <span>{t('booking.login.bringBack')}</span>
        </div>
      </div>
    </div>
  )
}
