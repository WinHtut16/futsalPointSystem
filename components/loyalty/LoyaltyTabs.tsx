'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Gift, Inbox, Users } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { loyaltyPath, type LoyaltyApp } from '@/lib/loyalty'
import { cn } from '@/lib/utils'

/** Requests · Rewards · Customers for one business. */
export default function LoyaltyTabs({ app, accent }: { app: LoyaltyApp; accent: string }) {
  const pathname = usePathname()
  const { t } = useLanguage()

  const tabs = [
    { href: loyaltyPath(app), label: t('loyalty.tabRequests'), icon: Inbox, exact: true },
    { href: loyaltyPath(app, '/rewards'), label: t('loyalty.tabRewards'), icon: Gift, exact: false },
    { href: loyaltyPath(app, '/customers'), label: t('loyalty.tabCustomers'), icon: Users, exact: false },
  ]

  return (
    <nav className="flex gap-1 rounded-xl bg-gray-100 p-1" aria-label={t('loyalty.title')}>
      {tabs.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            prefetch={false}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
              active ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-800',
            )}
            style={active ? { color: accent } : undefined}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
