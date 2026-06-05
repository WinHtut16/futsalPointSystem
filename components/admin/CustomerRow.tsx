'use client'

import { useState } from 'react'
import Link from 'next/link'
import { KeyRound, ChevronRight } from 'lucide-react'
import type { Profile } from '@/types'
import T from '@/components/ui/T'
import TempPasswordModal from '@/components/admin/TempPasswordModal'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { formatDate } from '@/lib/utils'

const AVATAR_COLORS = [
  { bg: 'bg-blue-100', text: 'text-blue-700' },
  { bg: 'bg-violet-100', text: 'text-violet-700' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  { bg: 'bg-orange-100', text: 'text-orange-700' },
  { bg: 'bg-rose-100', text: 'text-rose-700' },
  { bg: 'bg-cyan-100', text: 'text-cyan-700' },
  { bg: 'bg-amber-100', text: 'text-amber-700' },
  { bg: 'bg-indigo-100', text: 'text-indigo-700' },
]

export function getAvatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export function getInitials(name: string) {
  return (
    name
      .trim()
      .split(/[\s_]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? '')
      .join('') || name[0]?.toUpperCase() || '?'
  )
}

interface CustomerRowProps {
  customer: Profile
  hoursPlayed?: number
  /** Desktop table row variant vs mobile card */
  variant?: 'table' | 'card'
}

export default function CustomerRow({ customer, hoursPlayed, variant = 'card' }: CustomerRowProps) {
  const { t } = useLanguage()
  const [modalOpen, setModalOpen] = useState(false)
  const color = getAvatarColor(customer.username)
  const initials = getInitials(customer.username)

  const avatar = (
    <div
      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${color.bg} ${color.text}`}
    >
      {initials}
    </div>
  )

  if (variant === 'table') {
    return (
      <>
        <tr className="hover:bg-gray-50 transition-colors group">
          <td className="px-4 py-3">
            <Link href={`/admin/customers/${customer.id}`} className="flex items-center gap-2.5">
              {avatar}
              <span className="text-sm font-medium text-gray-900 group-hover:text-primary transition-colors">
                {customer.username}
              </span>
            </Link>
          </td>
          <td className="px-4 py-3 text-sm text-gray-500">{customer.phone ?? '—'}</td>
          <td className="px-4 py-3">
            {customer.total_points > 0 ? (
              <span className="text-sm font-bold text-gray-900">
                {customer.total_points.toLocaleString()}
              </span>
            ) : (
              <span className="text-sm text-gray-400">0</span>
            )}
          </td>
          <td className="px-4 py-3 text-sm text-gray-500">
            {hoursPlayed != null ? `${hoursPlayed.toFixed(1)}h` : '—'}
          </td>
          <td className="px-4 py-3 text-sm text-gray-500">{formatDate(customer.created_at)}</td>
          <td className="px-4 py-3 w-20 whitespace-nowrap">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                title={t('admin.resetPassword')}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-colors hover:border-gray-300 hover:bg-gray-50"
              >
                <KeyRound size={12} />
              </button>
              <Link
                href={`/admin/customers/${customer.id}`}
                title={t('admin.manageButton')}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 transition-colors hover:bg-gray-50 hover:border-gray-300"
              >
                <ChevronRight size={14} />
              </Link>
            </div>
          </td>
        </tr>
        <TempPasswordModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          customerId={customer.id}
          customerName={customer.username}
          customerPhone={customer.phone ?? ''}
        />
      </>
    )
  }

  // Mobile card variant
  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
        {avatar}
        <Link href={`/admin/customers/${customer.id}`} className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900">{customer.username}</p>
          <p className="text-xs text-gray-500">{customer.phone}</p>
        </Link>
        <div className="flex items-center gap-2 pl-2 shrink-0">
          <span className={`text-sm font-bold ${customer.total_points > 0 ? 'text-brand-600' : 'text-gray-400'}`}>
            {customer.total_points} <T k="common.pts" />
          </span>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            title={t('admin.resetPassword')}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-xs text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50"
          >
            <KeyRound size={12} />
          </button>
          <Link href={`/admin/customers/${customer.id}`} className="text-gray-300" tabIndex={-1} aria-hidden>
            <ChevronRight size={16} />
          </Link>
        </div>
      </div>
      <TempPasswordModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        customerId={customer.id}
        customerName={customer.username}
        customerPhone={customer.phone ?? ''}
      />
    </>
  )
}
