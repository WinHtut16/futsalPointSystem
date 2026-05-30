'use client'

import { Zap, Pencil, Gift } from 'lucide-react'
import type { PointTransaction } from '@/types'
import { formatDateTime } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface TransactionItemProps {
  tx: PointTransaction
  showCustomer?: boolean
  last?: boolean
}

export default function TransactionItem({ tx, showCustomer, last }: TransactionItemProps) {
  const { t, lang } = useLanguage()
  const isMy = lang === 'my'
  const isEarn = tx.transaction_type === 'earn'
  const isAdjustment = tx.transaction_type === 'adjustment'
  const isPositive = isEarn || (isAdjustment && tx.points_delta > 0)

  const Icon = isEarn ? Zap : isAdjustment ? Pencil : Gift

  const iconBg = isEarn
    ? 'var(--color-slot-available-bg)'
    : isAdjustment
      ? 'var(--color-surface-alt)'
      : 'var(--color-accent-soft)'

  const iconColor = isEarn
    ? 'var(--color-slot-available)'
    : isAdjustment
      ? 'var(--color-text-muted)'
      : 'oklch(0.45 0.13 78)'

  const amountColor = isPositive
    ? 'var(--color-slot-available)'
    : 'var(--color-slot-booked)'

  const label = isEarn
    ? `${t('tx.played')} ${tx.hours_played}h`
    : isAdjustment
      ? t('tx.adjustment')
      : (tx.reward?.name ?? t('tx.redemption'))

  const absAmount = Math.abs(tx.points_delta)
  const prefix = isPositive ? '+' : '−'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '13px 16px',
      borderBottom: last ? 'none' : '1px solid var(--color-line)',
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        background: iconBg, color: iconColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={17} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {showCustomer && tx.customer && (
          <p style={{
            fontSize: 11, fontWeight: 600,
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-display)',
            margin: '0 0 1px',
          }}>
            {tx.customer.username}
            <span style={{ color: 'var(--color-text-muted)', fontWeight: 400, marginLeft: 4, fontFamily: 'var(--font-mono)' }}>
              {tx.customer.phone}
            </span>
          </p>
        )}
        <p
          className={isMy ? 'my' : ''}
          style={{
            fontFamily: isMy ? 'var(--font-my)' : 'var(--font-display)',
            fontWeight: 700, fontSize: 13.5,
            color: 'var(--color-text-primary)', margin: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {label}
        </p>
        <p style={{
          fontFamily: 'var(--font-mono)', fontSize: 11.5,
          color: 'var(--color-text-muted)', margin: '2px 0 0',
        }}>
          {formatDateTime(tx.created_at)}
        </p>
        {tx.note && (
          <p
            className={isMy ? 'my' : ''}
            style={{
              fontSize: 11, color: 'var(--color-text-faint)',
              margin: '2px 0 0', fontStyle: 'italic',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {tx.note}
          </p>
        )}
      </div>

      <span style={{
        fontFamily: 'var(--font-display)', fontWeight: 800,
        fontSize: 15, letterSpacing: '-0.01em',
        color: amountColor, flexShrink: 0,
      }}>
        {prefix}{absAmount}
      </span>
    </div>
  )
}
