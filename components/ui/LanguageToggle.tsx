'use client'

import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function LanguageToggle({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const { lang, setLang } = useLanguage()

  const base = 'flex items-center rounded-full text-xs font-semibold overflow-hidden border transition-colors'
  const styles = {
    light: 'border-white/30',
    dark: 'border-gray-300',
  }
  const activeStyle = {
    light: 'bg-white text-brand-700',
    dark: 'bg-brand-600 text-white',
  }
  const inactiveStyle = {
    light: 'text-white/80 hover:text-white',
    dark: 'text-gray-500 hover:text-gray-700',
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
