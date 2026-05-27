'use client'

import Link from 'next/link'
import { Home, Calendar, Sparkles, User } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

const items = [
  { k: 'home', href: '/', Ic: Home, key: 'booking.nav.home' },
  { k: 'book', href: '/book', Ic: Calendar, key: 'booking.nav.book' },
  { k: 'news', href: '/news', Ic: Sparkles, key: 'booking.nav.news' },
  { k: 'me', href: '/bookings', Ic: User, key: 'booking.nav.account' },
] as const

export default function BottomNav({ active }: { active?: string }) {
  const { t, lang } = useLanguage()
  const my = lang === 'my' ? 'my' : ''
  return (
    <nav className="sticky bottom-0 z-20 grid grid-cols-4 border-t border-line bg-surface px-2 pb-1 pt-2 md:hidden">
      {items.map(({ k, href, Ic, key }) => {
        const on = k === active
        return (
          <Link
            key={k}
            href={href}
            className={`flex flex-col items-center gap-1 py-1.5 ${
              on ? 'text-primary' : 'text-ink-muted'
            }`}
          >
            <Ic size={20} strokeWidth={on ? 2.3 : 1.8} />
            <span className={`font-display text-[10px] ${on ? 'font-bold' : 'font-medium'} ${my}`}>
              {t(key as never)}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
