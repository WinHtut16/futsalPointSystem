'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { Zap } from 'lucide-react'

interface PointsCardProps {
  initialPoints: number
  username: string
  phone: string
  userId: string
}

export default function PointsCard({ initialPoints, username, phone, userId }: PointsCardProps) {
  const { t, lang } = useLanguage()
  const [points, setPoints] = useState(initialPoints)
  const isMy = lang === 'my'

  const initials = username
    .split(' ')
    .filter(Boolean)
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || username.slice(0, 2).toUpperCase()

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
    <div style={{
      background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))',
      color: 'var(--color-on-primary)',
      borderRadius: 'var(--r-xl)',
      padding: '22px 20px 20px',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-lg)',
    }}>
      {/* pitch-lines watermark */}
      <svg
        viewBox="0 0 200 100"
        aria-hidden="true"
        style={{ position: 'absolute', right: -12, top: -8, width: 200, opacity: 0.12, pointerEvents: 'none' }}
      >
        <rect x="10" y="10" width="180" height="80" stroke="#fff" strokeWidth="1.2" fill="none" />
        <line x1="100" y1="10" x2="100" y2="90" stroke="#fff" strokeWidth="0.8" />
        <circle cx="100" cy="50" r="14" stroke="#fff" strokeWidth="0.8" fill="none" />
        <rect x="10" y="30" width="20" height="40" stroke="#fff" strokeWidth="0.8" fill="none" />
        <rect x="170" y="30" width="20" height="40" stroke="#fff" strokeWidth="0.8" fill="none" />
      </svg>

      {/* identity row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%',
          background: 'rgba(255,255,255,0.2)',
          border: '1.5px solid rgba(255,255,255,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15,
          flexShrink: 0,
        }}>
          {initials}
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            className={isMy ? 'my' : ''}
            style={{
              fontSize: 15, fontWeight: 700,
              fontFamily: isMy ? 'var(--font-my)' : 'var(--font-display)',
              lineHeight: 1.2,
            }}
          >
            {username}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, opacity: 0.75, marginTop: 2 }}>
            {phone}
          </div>
        </div>
      </div>

      {/* balance */}
      <div style={{ marginTop: 22, position: 'relative' }}>
        <div
          className={isMy ? 'my' : ''}
          style={{
            fontSize: 11, opacity: 0.7,
            textTransform: 'uppercase', letterSpacing: '0.14em',
            fontFamily: 'var(--font-display)', fontWeight: 700,
          }}
        >
          {t('card.yourPoints')}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
          <span style={{
            fontFamily: 'var(--font-display)', fontWeight: 800,
            fontSize: 54, lineHeight: 1, letterSpacing: '-0.03em',
          }}>
            {points.toLocaleString()}
          </span>
          <span
            className={isMy ? 'my' : ''}
            style={{ fontSize: 14, opacity: 0.8 }}
          >
            {t('rewards.pts')}
          </span>
        </div>
      </div>

      {/* earn-rate strip */}
      <div style={{
        marginTop: 18, position: 'relative',
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'rgba(255,255,255,0.12)',
        borderRadius: 10, padding: '9px 12px',
      }}>
        <Zap size={15} strokeWidth={2.2} style={{ flexShrink: 0, opacity: 0.9 }} />
        <span
          className={isMy ? 'my' : ''}
          style={{
            fontSize: 12, fontWeight: 600,
            fontFamily: isMy ? 'var(--font-my)' : 'var(--font-display)',
          }}
        >
          {t('card.earnRate')}
        </span>
      </div>
    </div>
  )
}
