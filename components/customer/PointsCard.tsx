'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface PointsCardProps {
  initialPoints: number
  username: string
  phone: string
  userId: string
}

export default function PointsCard({ initialPoints, username, phone, userId }: PointsCardProps) {
  const { t } = useLanguage()
  const [points, setPoints] = useState(initialPoints)

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`profile-points-${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        (payload) => {
          const updated = payload.new as { id: string; total_points: number }
          if (updated.id === userId) setPoints(updated.total_points)
        }
      )
      .subscribe()

    const timer = setInterval(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('total_points')
        .eq('id', userId)
        .single()
      if (data) setPoints(data.total_points)
    }, 20_000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(timer)
    }
  }, [userId])

  return (
    <div className="bg-gradient-to-br from-brand-600 to-brand-800 rounded-2xl p-6 text-white shadow-lg">
      <p className="text-brand-200 text-sm font-medium">{username}</p>
      <p className="text-brand-300 text-xs mb-4">{phone}</p>
      <div className="text-center">
        <p className="text-brand-200 text-sm uppercase tracking-widest mb-1">{t('card.yourPoints')}</p>
        <p className="text-6xl font-bold tracking-tight">{points.toLocaleString()}</p>
        <p className="text-brand-300 text-sm mt-1">{t('rewards.pts')}</p>
      </div>
    </div>
  )
}
