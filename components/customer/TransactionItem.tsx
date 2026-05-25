'use client'

import type { PointTransaction } from '@/types'
import { formatDate } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface TransactionItemProps {
  tx: PointTransaction
  showCustomer?: boolean
}

export default function TransactionItem({ tx, showCustomer }: TransactionItemProps) {
  const { t } = useLanguage()
  const isEarn = tx.transaction_type === 'earn'
  const isAdjustment = tx.transaction_type === 'adjustment'
  const isPositiveAdjustment = isAdjustment && tx.points_delta > 0

  const icon = isEarn ? '⚽' : isAdjustment ? '✏️' : '🎁'

  const iconBg = isEarn
    ? 'bg-green-100'
    : isAdjustment
      ? 'bg-blue-100'
      : 'bg-orange-100'

  const amountColor = isEarn
    ? 'text-green-600'
    : isAdjustment
      ? isPositiveAdjustment
        ? 'text-blue-600'
        : 'text-red-500'
      : 'text-orange-500'

  const label = isEarn
    ? `${t('tx.played')} ${tx.hours_played}h`
    : isAdjustment
      ? t('tx.adjustment')
      : (tx.reward?.name ?? t('tx.redemption'))

  const amountPrefix = isEarn || isPositiveAdjustment ? '+' : ''

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-lg ${iconBg}`}>
          {icon}
        </div>
        <div className="min-w-0">
          {showCustomer && tx.customer && (
            <p className="text-xs font-semibold text-gray-700 truncate">
              {tx.customer.username}
              <span className="text-gray-400 font-normal ml-1">{tx.customer.phone}</span>
            </p>
          )}
          <p className="text-sm font-medium text-gray-800 truncate">{label}</p>
          <p className="text-xs text-gray-400">{formatDate(tx.created_at)}</p>
          {tx.note && <p className="text-xs text-gray-400 italic truncate">{tx.note}</p>}
        </div>
      </div>
      <span className={`text-sm font-bold shrink-0 ml-2 ${amountColor}`}>
        {amountPrefix}{tx.points_delta} {t('rewards.pts')}
      </span>
    </div>
  )
}
