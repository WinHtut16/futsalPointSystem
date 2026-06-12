'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export type ActivityFeedItem = {
  id: string
  type: 'booking_confirmed' | 'booking_pending' | 'redemption_approved' | 'redemption_rejected' | 'new_customer'
  name: string
  detail?: string
  timestamp: string
}

const DOT_COLORS: Record<ActivityFeedItem['type'], string> = {
  booking_confirmed: '#1D9E75',
  booking_pending: '#f59e0b',
  redemption_approved: '#f59e0b',
  redemption_rejected: '#ef4444',
  new_customer: '#3b82f6',
}

function relativeTime(isoStr: string, justNow: string): string {
  const diff = Date.now() - new Date(isoStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 2) return justNow
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

function FeedRow({ item, justNow }: { item: ActivityFeedItem; justNow: string }) {
  const { t } = useLanguage()
  const [time, setTime] = useState('')

  useEffect(() => {
    setTime(relativeTime(item.timestamp, justNow))
    const id = setInterval(() => setTime(relativeTime(item.timestamp, justNow)), 60_000)
    return () => clearInterval(id)
  }, [item.timestamp, justNow])

  const eventLabel: Record<ActivityFeedItem['type'], string> = {
    booking_confirmed: t('admin.dashEvtBookingConfirmed'),
    booking_pending: t('admin.dashEvtBookingPending'),
    redemption_approved: t('admin.dashEvtRedemptionApproved'),
    redemption_rejected: t('admin.dashEvtRedemptionRejected'),
    new_customer: t('admin.dashEvtNewCustomer'),
  }

  return (
    <div className="flex items-start gap-2.5 py-2 first:pt-0 last:pb-0">
      <span
        className="w-2 h-2 rounded-full shrink-0 mt-1.5"
        style={{ backgroundColor: DOT_COLORS[item.type] }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-700 truncate">
          {eventLabel[item.type]}
          {item.detail && (
            <span className="font-normal text-gray-500"> — {item.detail}</span>
          )}
        </p>
        <p className="text-[11px] text-gray-400 truncate">{item.name}</p>
      </div>
      <span className="text-[11px] text-gray-400 shrink-0 tabular-nums">{time}</span>
    </div>
  )
}

export default function RecentActivityFeed({ items }: { items: ActivityFeedItem[] }) {
  const { t } = useLanguage()
  const justNow = t('admin.dashJustNow')

  if (items.length === 0) {
    return (
      <div className="h-[140px] flex items-center justify-center text-sm text-gray-400">
        {t('admin.dashNoRecentActivity')}
      </div>
    )
  }

  return (
    <div className="divide-y divide-gray-50">
      {items.map((item) => (
        <FeedRow key={item.id} item={item} justNow={justNow} />
      ))}
    </div>
  )
}
