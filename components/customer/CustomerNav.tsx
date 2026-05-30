'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Receipt, Gift } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { LucideIcon } from 'lucide-react'

const LINKS: { href: string; labelKey: 'nav.home' | 'nav.history' | 'nav.rewards'; Icon: LucideIcon }[] = [
  { href: '/dashboard', labelKey: 'nav.home', Icon: Home },
  { href: '/history',   labelKey: 'nav.history', Icon: Receipt },
  { href: '/rewards',   labelKey: 'nav.rewards', Icon: Gift },
]

export default function CustomerNav() {
  const pathname = usePathname()
  const { t, lang } = useLanguage()
  const isMy = lang === 'my'

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      display: 'grid', gridTemplateColumns: 'repeat(3,1fr)',
      borderTop: '1px solid var(--color-line)',
      background: 'var(--color-surface)',
      padding: '8px 8px 4px',
      zIndex: 50,
    }}>
      {LINKS.map(({ href, labelKey, Icon }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 4, padding: '6px 0', textDecoration: 'none',
              color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
            }}
          >
            <Icon size={20} strokeWidth={active ? 2.3 : 1.8} />
            <span
              className={isMy ? 'my' : ''}
              style={{
                fontFamily: isMy ? 'var(--font-my)' : 'var(--font-display)',
                fontSize: 10, fontWeight: active ? 700 : 500,
                letterSpacing: '0.02em',
              }}
            >
              {t(labelKey)}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
