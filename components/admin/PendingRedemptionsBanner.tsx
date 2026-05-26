'use client'

import Link from 'next/link'
import { usePendingRedemptions } from '@/contexts/PendingRedemptionsContext'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function PendingRedemptionsBanner() {
  const { count } = usePendingRedemptions()
  const { t } = useLanguage()

  if (count === 0) return null

  return (
    <Link href="/admin/redemptions">
      <div className="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
        <div>
          <p className="font-semibold text-yellow-800 text-sm">{t('admin.pendingRedemptions')}</p>
          <p className="text-xs text-yellow-600">{t('admin.tapToReview')}</p>
        </div>
        <span className="bg-yellow-400 text-yellow-900 font-bold text-sm px-2.5 py-0.5 rounded-full">
          {count}
        </span>
      </div>
    </Link>
  )
}
