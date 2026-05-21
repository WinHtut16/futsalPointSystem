'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function CustomerNav() {
  const pathname = usePathname()
  const { t } = useLanguage()

  const links = [
    { href: '/dashboard', label: t('nav.home'), icon: '🏠' },
    { href: '/history', label: t('nav.history'), icon: '📋' },
    { href: '/rewards', label: t('nav.rewards'), icon: '🎁' },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            'flex-1 flex flex-col items-center py-2 text-xs transition-colors',
            pathname === link.href
              ? 'text-brand-600 font-semibold'
              : 'text-gray-500 hover:text-gray-700'
          )}
        >
          <span className="text-xl leading-none mb-0.5">{link.icon}</span>
          {link.label}
        </Link>
      ))}
    </nav>
  )
}
