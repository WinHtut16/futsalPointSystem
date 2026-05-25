'use client'

import { useRealtimePoints } from '@/hooks/useRealtimePoints'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface RealtimePointsBadgeProps {
  userId: string
  initialPoints: number
}

export default function RealtimePointsBadge({ userId, initialPoints }: RealtimePointsBadgeProps) {
  const { t } = useLanguage()
  const points = useRealtimePoints(userId, initialPoints)

  return (
    <span className="text-sm text-gray-500 bg-white border border-gray-200 px-2 py-1 rounded-lg font-semibold text-brand-600">
      {points} {t('rewards.pts')}
    </span>
  )
}
