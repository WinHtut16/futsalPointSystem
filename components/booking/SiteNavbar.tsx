'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Calendar, ChevronLeft, User } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { createClient } from '@/lib/supabase/client'
import BookingLangToggle from './BookingLangToggle'

const navItems = [
  { k: 'home', href: '/', key: 'booking.nav.home' },
  { k: 'booking', href: '/book', key: 'booking.nav.book' },
  { k: 'news', href: '/news', key: 'booking.nav.news' },
  { k: 'account', href: '/account', key: 'booking.nav.account' },
] as const

// Persistent top nav — rendered once in app/(site)/layout.tsx.
// active/back/mobileTitle are derived from the current pathname so this
// component never needs per-page props and never re-mounts on navigation.
// initialFirstName seeds auth state server-side (no flash on first paint).
export default function SiteNavbar({
  initialFirstName,
}: {
  initialFirstName?: string | null
}) {
  const { t, lang } = useLanguage()
  const my = lang === 'my' ? 'my' : ''
  const pathname = usePathname()

  const active = pathname === '/' ? 'home'
    : pathname.startsWith('/book') ? 'booking'
    : pathname === '/news' ? 'news'
    : pathname.startsWith('/account') ? 'account'
    : 'home'
  const back = pathname === '/book' || pathname.startsWith('/book/confirm')
  const mobileTitle = pathname.startsWith('/book/confirm')
    ? t('booking.confirm.title')
    : pathname === '/news'
    ? t('booking.news.title')
    : undefined

  const [firstName, setFirstName] = useState<string | null>(
    initialFirstName !== undefined ? initialFirstName : null
  )
  const [hydrating, setHydrating] = useState(initialFirstName === undefined)

  useEffect(() => {
    const supabase = createClient()

    if (initialFirstName === undefined) {
      // Fallback for any render without server seeding (e.g. loading.tsx shim).
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          const name = (user.user_metadata?.username as string | undefined) ?? user.email?.split('@')[0] ?? ''
          setFirstName(name.split(' ')[0] || null)
        }
        setHydrating(false)
      })
    }

    // Keep in sync with login/logout events during the session.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const name = (session.user.user_metadata?.username as string | undefined) ?? session.user.email?.split('@')[0] ?? ''
        setFirstName(name.split(' ')[0] || null)
      } else if (event === 'SIGNED_OUT') {
        setFirstName(null)
      }
    })

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
