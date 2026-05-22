'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface Props { role: UserRole }

export default function AdminNav({ role }: Props) {
  const pathname = usePathname()
  const { t } = useLanguage()

  const baseLinks = [
    { href: '/admin/dashboard', label: t('admin.navDashboard') },
    { href: '/admin/customers', label: t('admin.navCustomers') },
    { href: '/admin/redemptions', label: t('admin.navRequests') },
    { href: '/admin/rewards', label: t('admin.navRewards') },
  ]
  const superadminLinks = [{ href: '/admin/staff', label: t('admin.navStaff') }]
  const links = role === 'superadmin' ? [...baseLinks, ...superadminLinks] : baseLinks

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
          {link.label}
        </Link>
      ))}
    </nav>
  )
}
