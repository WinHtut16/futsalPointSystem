'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, ClipboardList, Gift } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { LucideIcon } from 'lucide-react'

export default function CustomerNav() {
  const pathname = usePathname()
  const { t } = useLanguage()

  const links: { href: string; label: string; Icon: LucideIcon }[] = [
    { href: '/dashboard', label: t('nav.home'), Icon: Home },
    { href: '/history', label: t('nav.history'), Icon: ClipboardList },
    { href: '/rewards', label: t('nav.rewards'), Icon: Gift },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex">
      {links.map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            'flex-1 flex flex-col items-center py-2 text-xs transition-colors',
            pathname === href
              ? 'text-brand-600 font-semibold'
              : 'text-gray-500 hover:text-gray-700'
          )}
        >
          <Icon className="w-5 h-5 mb-0.5" />
          {label}
        </Link>
      ))}
    </nav>
  )
}
