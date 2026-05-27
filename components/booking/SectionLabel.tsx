'use client'

import { ArrowRight } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function SectionLabel({
  kicker,
  title,
  action,
  href,
}: {
  kicker?: string
  title?: string
  action?: string
  href?: string
}) {
  const { lang } = useLanguage()
  const my = lang === 'my' ? 'my' : ''
  return (
    <div className="mb-3.5 flex items-end justify-between">
      <div>
        {kicker && (
          <div className="mb-1 font-display text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
            {kicker}
          </div>
        )}
        {title && (
          <div className={`font-display text-xl font-bold tracking-tight text-ink-primary ${my}`}>
            {title}
          </div>
        )}
      </div>
      {action && (
        <a
          href={href}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
        >
          {action} <ArrowRight size={14} />
        </a>
      )}
    </div>
  )
}
