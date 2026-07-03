'use client'

import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function LanguageToggle({ variant = 'light' }: { variant?: 'light' | 'dark' | 'admin' }) {
  const { lang, setLang } = useLanguage()

  const base = 'flex items-center rounded-full text-xs font-semibold overflow-hidden border transition-colors'
  const styles = {
    light: 'border-white/30',
    dark: 'border-white/20',
    admin: 'border-line',
  }
  const activeStyle = {
    light: 'bg-white text-brand-700',
    dark: 'bg-white text-gray-900',
    admin: 'bg-primary text-white',
  }
  const inactiveStyle = {
    light: 'text-white/80 hover:text-white',
    dark: 'text-white/60 hover:text-white',
    admin: 'text-ink-muted hover:text-ink',
  }

  return (
    <div className={`${base} ${styles[variant]}`}>
      <button
        onClick={() => setLang('en')}
        className={`px-2.5 py-1 ${lang === 'en' ? activeStyle[variant] : inactiveStyle[variant]}`}
      >
        EN
      </button>
      <button
        onClick={() => setLang('my')}
        className={`px-2.5 py-1 ${lang === 'my' ? activeStyle[variant] : inactiveStyle[variant]}`}
      >
        မြန်မာ
      </button>
    </div>
  )
}
