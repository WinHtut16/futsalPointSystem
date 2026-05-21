'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types'

const BASE_LINKS = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/customers', label: 'Customers' },
  { href: '/admin/redemptions', label: 'Requests' },
  { href: '/admin/rewards', label: 'Rewards' },
]

const SUPERADMIN_LINKS = [
  { href: '/admin/staff', label: 'Staff' },
]

interface Props {
  role: UserRole
}

export default function AdminNav({ role }: Props) {
  const pathname = usePathname()
  const links = role === 'superadmin' ? [...BASE_LINKS, ...SUPERADMIN_LINKS] : BASE_LINKS

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
