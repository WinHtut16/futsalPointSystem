import type { PointTransaction } from '@/types'
import { formatDate } from '@/lib/utils'

interface TransactionItemProps {
  tx: PointTransaction
  showCustomer?: boolean
}

export default function TransactionItem({ tx, showCustomer }: TransactionItemProps) {
  const isEarn = tx.transaction_type === 'earn'

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-lg ${isEarn ? 'bg-green-100' : 'bg-orange-100'}`}>
          {isEarn ? '⚽' : '🎁'}
        </div>
        <div className="min-w-0">
          {showCustomer && tx.customer && (
            <p className="text-xs font-semibold text-gray-700 truncate">
              {tx.customer.username}
              <span className="text-gray-400 font-normal ml-1">{tx.customer.phone}</span>
            </p>
          )}
          <p className="text-sm font-medium text-gray-800 truncate">
            {isEarn
              ? `Played ${tx.hours_played}h`
              : (tx.reward?.name ?? 'Redemption')}
          </p>
          <p className="text-xs text-gray-400">{formatDate(tx.created_at)}</p>
          {tx.note && <p className="text-xs text-gray-400 italic truncate">{tx.note}</p>}
        </div>
      </div>
      <span className={`text-sm font-bold shrink-0 ml-2 ${isEarn ? 'text-green-600' : 'text-orange-500'}`}>
        {isEarn ? '+' : ''}{tx.points_delta} pts
      </span>
    </div>
  )
}
