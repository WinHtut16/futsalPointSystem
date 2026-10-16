'use client'

import { useLanguage } from '@/lib/i18n/LanguageContext'

// EN / Burmese switch for the park pages. Shares the one `lang` cookie with
// the futsal site, so a choice made here carries over to /futsal and /book.
export default function ParkLangToggle({ dark = false }: { dark?: boolean }) {
  const { lang, setLang, t } = useLanguage()
  const track = dark ? 'border-white/25' : 'border-[rgba(15,77,60,0.25)]'
  const on = dark ? 'bg-white text-park-ink' : 'bg-park-jungle text-white'
  const off = dark ? 'text-white/75 hover:text-white' : 'text-[rgba(15,77,60,0.75)] hover:text-park-jungle'

  return (
    <div role="group" aria-label={t('park.lang.label')} className={`inline-flex rounded-full border p-[3px] ${track}`}>
      {(
        [
          ['en', 'EN'],
          ['my', 'မြန်မာ'],
        ] as const
      ).map(([L, label]) => (
        <button
          key={L}
          type="button"
          lang={L}
          aria-pressed={lang === L}
          onClick={() => setLang(L)}
          className={`min-h-[38px] rounded-full px-3 text-sm font-semibold transition-colors ${lang === L ? on : off}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
