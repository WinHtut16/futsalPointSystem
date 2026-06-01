'use client'

import { useState } from 'react'
import Link from 'next/link'
import { KeyRound } from 'lucide-react'
import type { Profile } from '@/types'
import T from '@/components/ui/T'
import TempPasswordModal from '@/components/admin/TempPasswordModal'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface CustomerRowProps {
  customer: Profile
}

export default function CustomerRow({ customer }: CustomerRowProps) {
  const { t } = useLanguage()
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
        <Link
          href={`/admin/customers/${customer.id}`}
          className="min-w-0 flex-1"
        >
          <p className="text-sm font-medium text-gray-900">{customer.username}</p>
          <p className="text-xs text-gray-500">{customer.phone}</p>
        </Link>
        <div className="flex items-center gap-2 pl-3">
          <span className="text-sm font-bold text-brand-600">
            {customer.total_points} <T k="common.pts" />
          </span>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            title={t('admin.resetPassword')}
            className="flex h-7 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2 text-xs font-medium text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50"
          >
            <KeyRound size={12} />
            <span className="hidden sm:inline">{t('admin.resetPassword')}</span>
          </button>
          <Link
            href={`/admin/customers/${customer.id}`}
            className="text-gray-400"
            tabIndex={-1}
            aria-hidden="true"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
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