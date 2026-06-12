'use client'

import { useLanguage } from '@/lib/i18n/LanguageContext'
import { formatDateTime } from '@/lib/utils'

export type ActivityLogItem = {
  id: string
  type:
    | 'booking_pending'
    | 'booking_confirmed'
    | 'booking_cancelled'
    | 'booking_closed'
    | 'point_earn'
    | 'point_adjustment'
    | 'redemption_pending'
    | 'redemption_approved'
    | 'redemption_rejected'
    | 'redemption_cancelled'
  name: string
  detail?: string
  timestamp: string
}

const DOT_COLORS: Record<ActivityLogItem['type'], string> = {
  booking_pending: '#f59e0b',
  booking_confirmed: '#1D9E75',
  booking_cancelled: '#ef4444',
  booking_closed: '#9ca3af',
  point_earn: '#1D9E75',
  point_adjustment: '#3b82f6',
  redemption_pending: '#f59e0b',
  redemption_approved: '#1D9E75',
  redemption_rejected: '#ef4444',
  redemption_cancelled: '#9ca3af',
}

export default function ActivityLogList({ items }: { items: ActivityLogItem[] }) {
  const { t, lang } = useLanguage()

  const eventLabel: Record<ActivityLogItem['type'], string> = {
    booking_pending: t('admin.dashEvtBookingPending'),
    booking_confirmed: t('admin.dashEvtBookingConfirmed'),
    booking_cancelled: t('admin.dashEvtBookingCancelled'),
    booking_closed: t('admin.dashEvtBookingClosed'),
    point_earn: t('admin.dashEvtPointEarn'),
    point_adjustment: t('admin.dashEvtPointAdjustment'),
    redemption_pending: t('admin.dashEvtRedemptionPending'),
    redemption_approved: t('admin.dashEvtRedemptionApproved'),
    redemption_rejected: t('admin.dashEvtRedemptionRejected'),
    redemption_cancelled: t('admin.dashEvtRedemptionCancelled'),
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 py-12 text-center text-sm text-gray-400">
        {t('admin.activityNoResults')}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50">
      {items.map((item) => (
        <div key={item.id} className="flex items-start gap-3 px-4 py-3 min-h-[48px]">
          <span
            className="w-2 h-2 rounded-full shrink-0 mt-[7px]"
            style={{ backgroundColor: DOT_COLORS[item.type] }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-0.5 sm:gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-700">
                  {eventLabel[item.type]}
                  {item.detail && (
                    <span className="font-normal text-gray-500"> — {item.detail}</span>
                  )}
                </p>
                <p className="text-xs text-gray-400 truncate">{item.name}</p>
              </div>
              <span className="text-xs text-gray-400 tabular-nums sm:shrink-0 sm:text-right sm:pt-0.5">
                {formatDateTime(item.timestamp, lang)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
