'use client'

import { useLanguage } from '@/lib/i18n/LanguageContext'

function initials(name: string) {
  return name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || 'NW'
}

// Flat balance — no tiers. An earn-rate strip replaces the old Silver/Gold progress bar.
export default function PointsCard({ name, points }: { name: string; points: number }) {
  const { t, lang } = useLanguage()
  const my = lang === 'my' ? 'my' : ''

  return (
    <div
      className="relative overflow-hidden rounded-[var(--r-xl)] p-5 text-white"
      style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))' }}
    >
      <svg viewBox="0 0 200 100" className="absolute -right-2.5 -top-2.5 w-44 opacity-[0.12]">
        <rect x="10" y="10" width="180" height="80" stroke="#fff" strokeWidth="1.2" fill="none" />
        <line x1="100" y1="10" x2="100" y2="90" stroke="#fff" strokeWidth="0.8" />
        <circle cx="100" cy="50" r="14" stroke="#fff" strokeWidth="0.8" fill="none" />
      </svg>

      <div className="relative flex items-center gap-3">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full font-display text-base font-bold"
          style={{ background: 'rgba(255,255,255,0.14)', boxShadow: '0 0 0 2px rgba(255,255,255,0.25)' }}
        >
          {initials(name)}
        </div>
        <div className={`font-display text-base font-bold ${my}`}>{name}</div>
      </div>

      <div className="relative mt-5 flex items-baseline gap-2.5">
        <span className="font-display text-[48px] font-extrabold leading-none tracking-tight">
          {points.toLocaleString('en-US')}
        </span>
        <span className={`text-[13px] opacity-80 ${my}`}>{t('booking.dash.points')}</span>
      </div>

    </div>
  )
}
