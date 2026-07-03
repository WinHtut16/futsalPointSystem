'use client'

import { useLanguage } from '@/lib/i18n/LanguageContext'

// Pill toggle matching the booking design (surface-alt track, primary active).
// Separate from components/ui/LanguageToggle.tsx so the live points-system
// styling stays untouched.
export default function BookingLangToggle({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useLanguage()
  const pad = compact ? 'px-2.5 py-1' : 'px-3.5 py-1.5'

  return (
    <div className="inline-flex rounded-full border border-line bg-surface-alt p-[3px] font-display text-xs font-semibold">
      {(['en', 'my'] as const).map((L) => (
        <button
          key={L}
          type="button"
          onClick={() => setLang(L)}
          className={`${pad} rounded-full tracking-wide transition-colors ${
            lang === L ? 'bg-primary text-primary-on' : 'text-ink-muted'
          }`}
        >
          {L.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
