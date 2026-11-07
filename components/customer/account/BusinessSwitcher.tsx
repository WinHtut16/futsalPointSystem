'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { CUSTOMER_BUSINESSES } from '@/lib/points'
import type { AppName } from '@/lib/apps'
import type { TranslationKey } from '@/lib/i18n'

const LABEL: Record<AppName, TranslationKey> = {
  futsal: 'account.biz.futsal',
  game: 'account.biz.game',
  billiards: 'account.biz.billiards',
}

/**
 * Which business's points the account page shows: Futsal · ACJ Gaming ·
 * CueX Billiards. One account and phone number everywhere; balances and
 * rewards never mix.
 *
 * Plain links, not client state: the page reads ?biz= on the server and
 * fetches that business's balance, rewards and history there - nothing in the
 * browser talks to Supabase directly beyond the existing polls (several
 * Myanmar networks block *.supabase.co).
 */
export default function BusinessSwitcher({ active, tab }: { active: AppName; tab: string }) {
  const { t, lang } = useLanguage()
  const my = lang === 'my' ? 'my' : ''

  return (
    <div className="mx-4 mt-4">
      <div className={`mb-1.5 font-display text-[11px] font-bold uppercase tracking-[0.1em] text-ink-faint ${my}`}>
        {t('account.bizSwitcherLabel')}
      </div>
      <div className="grid grid-cols-3 gap-1 rounded-[var(--r-md)] bg-surface-alt p-1" role="tablist">
        {CUSTOMER_BUSINESSES.map((b) => {
          const on = b === active
          return (
            <Link
              key={b}
              href={`/account?tab=${tab}&biz=${b}`}
              replace
              scroll={false}
              role="tab"
              aria-selected={on}
              className={`rounded-[var(--r-sm)] px-2 py-2 text-center font-display text-[12.5px] leading-tight transition-colors ${my} ${
                on ? 'bg-white font-bold text-primary shadow-sm' : 'font-semibold text-ink-muted hover:text-ink-primary'
              }`}
            >
              {t(LABEL[b])}
            </Link>
          )
        })}
      </div>
      <p className={`mt-1.5 text-[11.5px] text-ink-muted ${my}`}>{t('account.bizNote')}</p>
    </div>
  )
}
