'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { en, my, type Language, type TranslationKey } from './index'

const map = { en, my }

interface LanguageContextValue {
  lang: Language
  setLang: (l: Language) => void
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'en',
  setLang: () => {},
  t: (key) => en[key] ?? key,
})

export function LanguageProvider({
  children,
  initialLang,
}: {
  children: React.ReactNode
  initialLang?: Language
}) {
  const [lang, setLangState] = useState<Language>(initialLang ?? 'en')

  // One-time migration: server sent 'en' (no cookie yet) but user previously set
  // MY via localStorage. Adopt it and write the cookie so future page loads are
  // flash-free from the server side.
  useEffect(() => {
    if (lang !== 'en') return
    try {
      const stored = localStorage.getItem('lang') as Language | null
      if (stored === 'my') {
        setLangState('my')
        document.documentElement.lang = 'my'
        document.documentElement.dataset.lang = 'my'
        document.cookie = 'lang=my;path=/;max-age=31536000;SameSite=Lax'
      }
    } catch {}
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function setLang(l: Language) {
    setLangState(l)
    document.documentElement.lang = l
    document.documentElement.dataset.lang = l
    try { localStorage.setItem('lang', l) } catch {}
    document.cookie = `lang=${l};path=/;max-age=31536000;SameSite=Lax`
  }

  function t(key: TranslationKey, vars?: Record<string, string | number>) {
    let str = map[lang][key] ?? map.en[key] ?? key
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(`{${k}}`, String(v))
      }
    }
    return str
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
