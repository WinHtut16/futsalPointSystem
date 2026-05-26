'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { usePendingRedemptions } from '@/contexts/PendingRedemptionsContext'

interface Props { role: UserRole }

export default function AdminNav({ role }: Props) {
  const pathname = usePathname()
  const { t } = useLanguage()
  const { count } = usePendingRedemptions()

  const baseLinks = [
    { href: '/admin/dashboard', label: t('admin.navDashboard') },
    { href: '/admin/customers', label: t('admin.navCustomers') },
    { href: '/admin/redemptions', label: t('admin.navRequests') },
    { href: '/admin/rewards', label: t('admin.navRewards') },
  ]
  const superadminLinks = [{ href: '/admin/staff', label: t('admin.navStaff') }]
  const links = role === 'superadmin' ? [...baseLinks, ...superadminLinks] : baseLinks

  const badgeText = count > 99 ? '99+' : String(count)

  return (
    <nav className="bg-gray-800 text-sm flex">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            'flex-1 text-center py-2.5 font-medium transition-colors',
            pathname.startsWith(link.href)
              ? 'text-white border-b-2 border-brand-400'
              : 'text-gray-400 hover:text-white'
          )}
        >
          {link.href === '/admin/redemptions' ? (
            <span className="relative inline-block">
              {link.label}
              {count > 0 && (
                <span className="absolute -top-2 -right-3 bg-amber-400 text-amber-900 text-[10px] font-bold leading-none px-1 py-0.5 rounded-full min-w-[16px] text-center">
                  {badgeText}
                </span>
              )}
            </span>
          ) : (
            link.label
          )}
        </Link>
      ))}
    </nav>
  )
}
