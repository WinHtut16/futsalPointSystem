import type { PointTransaction } from '@/types'
import { formatDate } from '@/lib/utils'

interface TransactionItemProps {
  tx: PointTransaction
}

export default function TransactionItem({ tx }: TransactionItemProps) {
  const isEarn = tx.transaction_type === 'earn'

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-lg ${isEarn ? 'bg-green-100' : 'bg-orange-100'}`}>
          {isEarn ? '⚽' : '🎁'}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-800">
            {isEarn
              ? `Played ${tx.hours_played}h`
              : (tx.reward?.name ?? 'Redemption')}
          </p>
          <p className="text-xs text-gray-400">{formatDate(tx.created_at)}</p>
          {tx.note && <p className="text-xs text-gray-400 italic">{tx.note}</p>}
        </div>
      </div>
      <span className={`text-sm font-bold ${isEarn ? 'text-green-600' : 'text-orange-500'}`}>
        {isEarn ? '+' : ''}{tx.points_delta} pts
      </span>
    </div>
  )
}
