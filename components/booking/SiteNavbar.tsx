'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Calendar, ChevronLeft } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import BookingLangToggle from './BookingLangToggle'

const navItems = [
  { k: 'home', href: '/', key: 'booking.nav.home' },
  { k: 'booking', href: '/book', key: 'booking.nav.book' },
  { k: 'news', href: '/news', key: 'booking.nav.news' },
  { k: 'dashboard', href: '/bookings', key: 'booking.nav.account' },
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

  return (
    <>
      {/* Desktop */}
      <div className="hidden items-center justify-between border-b border-line bg-surface px-8 py-4 md:flex">
        <Link href="/">
          <Image src="/logo_black.jpg" alt="Mya Thida Futsal" width={928} height={844} className="h-9 w-auto object-contain" />
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
        <BookingLangToggle compact />
      </div>
    </>
  )
}
