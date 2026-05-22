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

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>('en')

  useEffect(() => {
    const stored = localStorage.getItem('lang') as Language | null
    if (stored === 'en' || stored === 'my') setLangState(stored)
  }, [])

  function setLang(l: Language) {
    setLangState(l)
    localStorage.setItem('lang', l)
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
