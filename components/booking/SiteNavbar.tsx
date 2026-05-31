'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Calendar, ChevronLeft, User } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { createClient } from '@/lib/supabase/client'
import BookingLangToggle from './BookingLangToggle'

const navItems = [
  { k: 'home', href: '/', key: 'booking.nav.home' },
  { k: 'booking', href: '/book', key: 'booking.nav.book' },
  { k: 'news', href: '/news', key: 'booking.nav.news' },
] as const

// Responsive top navigation: full bar on desktop, compact top bar on mobile.
export default function SiteNavbar({
  active = 'home',
  mobileTitle,
  back = false,
}: {
  active?: string
  mobileTitle?: string
  back?: boolean
}) {
  const { t, lang } = useLanguage()
  const my = lang === 'my' ? 'my' : ''
  const [firstName, setFirstName] = useState<string | null>(null)
  const [hydrating, setHydrating] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const name = (user.user_metadata?.username as string | undefined) ?? user.email?.split('@')[0] ?? ''
        setFirstName(name.split(' ')[0] || null)
      }
      setHydrating(false)
    })
  }, [])

  const accountHref = firstName ? '/account' : '/login'

  return (
    <>
      {/* Desktop */}
      <div className="hidden items-center justify-between border-b border-line bg-surface px-8 py-4 md:flex">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo_black.jpg" alt="Mya Thida Futsal" width={928} height={844} className="h-9 w-auto object-contain" />
          <span className="font-display text-[13px] font-bold tracking-widest text-ink-primary">MYA THIDA</span>
        </Link>
        <div className="flex items-center gap-7">
          {navItems.map(({ k, href, key }) => (
            <Link
              key={k}
              href={href}
              className={`border-b-2 pb-1.5 text-sm ${my} ${
                active === k
                  ? 'border-primary font-bold text-ink-primary'
                  : 'border-transparent font-medium text-ink-muted'
              }`}
            >
              {t(key as never)}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <BookingLangToggle compact />
          <Link
            href={accountHref}
            className="flex items-center gap-1.5 font-display text-sm font-semibold text-ink-muted transition-colors hover:text-ink-primary"
          >
            <User size={17} className={firstName ? 'text-primary' : 'text-ink-muted'} />
            {!hydrating && <span className={my}>{firstName ?? t('booking.nav.login')}</span>}
          </Link>
          <Link href="/book" className="fb-btn fb-btn-primary !px-4 !py-2.5">
            <Calendar size={14} />
            <span className={my}>{t('booking.nav.bookNow')}</span>
          </Link>
        </div>
      </div>

      {/* Mobile */}
      <div className="flex min-h-[56px] items-center justify-between border-b border-line bg-surface px-4 py-3 md:hidden">
        <div className="flex items-center gap-2.5">
          {back ? (
            <button
              type="button"
              onClick={() => history.back()}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-ink-primary"
              aria-label="Back"
            >
              <ChevronLeft size={18} />
            </button>
          ) : (
            <Link href="/">
              <Image src="/logo_black.jpg" alt="Mya Thida Futsal" width={928} height={844} className="h-7 w-auto object-contain" />
            </Link>
          )}
          {mobileTitle && (
            <span className={`font-display text-base font-bold text-ink-primary ${my}`}>
              {mobileTitle}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <BookingLangToggle compact />
          <Link
            href={accountHref}
            className="flex h-9 w-9 items-center justify-center rounded-full"
            aria-label={firstName ? 'My account' : 'Login'}
          >
            <User size={19} className={firstName ? 'text-primary' : 'text-ink-muted'} />
          </Link>
        </div>
      </div>
    </>
  )
}
