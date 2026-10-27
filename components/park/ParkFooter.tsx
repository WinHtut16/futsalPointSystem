'use client'

import Link from 'next/link'
import { MessageCircle, Phone, Globe } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { PARK } from '@/lib/park/content'
import ViberLink from './ViberLink'

export default function ParkFooter() {
  const { t } = useLanguage()
  const year = new Date().getFullYear()

  return (
    <footer className="bg-park-jungle text-[#d7ebdf]">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-4 py-14 md:grid-cols-[1.4fr_1fr_1fr] md:px-8">
        <div className="flex flex-col gap-3">
          <span className="park-display text-2xl text-white">{t('park.brand')}</span>
          <p className="max-w-[32ch] leading-relaxed">{t('park.footer.tagline')}</p>
        </div>

        <nav aria-labelledby="park-footer-places" className="flex flex-col">
          <h2 id="park-footer-places" className="mb-1 font-semibold text-white">
            {t('park.footer.places')}
          </h2>
          <Link href="/pool" className="inline-flex min-h-[44px] items-center hover:text-white">{t('park.nav.pool')}</Link>
          <Link href="/futsal" className="inline-flex min-h-[44px] items-center hover:text-white">{t('park.nav.futsal')}</Link>
          <Link href="/games" className="inline-flex min-h-[44px] items-center hover:text-white">{t('park.nav.games')}</Link>
          <Link href="/billiards" className="inline-flex min-h-[44px] items-center hover:text-white">{t('park.nav.billiards')}</Link>
          <Link href="/#visit" className="inline-flex min-h-[44px] items-center hover:text-white">{t('park.nav.visit')}</Link>
        </nav>

        <div className="flex flex-col">
          <h2 className="mb-1 font-semibold text-white">{t('park.footer.contact')}</h2>
          <ViberLink className="inline-flex min-h-[44px] items-center gap-2 hover:text-white">
            <MessageCircle size={18} aria-hidden="true" />
            {t('park.footer.viber')}
          </ViberLink>
          {PARK.phone && (
            <a href={`tel:${PARK.phone.replace(/\s/g, '')}`} className="inline-flex min-h-[44px] items-center gap-2 hover:text-white">
              <Phone size={18} aria-hidden="true" />
              {t('park.footer.call', { phone: PARK.phone })}
            </a>
          )}
          {PARK.facebookUrl && (
            <a href={PARK.facebookUrl} className="inline-flex min-h-[44px] items-center gap-2 hover:text-white" rel="noopener">
              <Globe size={18} aria-hidden="true" />
              {t('park.footer.facebook')}
            </a>
          )}
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-[1200px] px-4 py-5 text-sm text-[#a9c9b7] md:px-8">
          {t('park.footer.rights', { year: String(year) })}
        </p>
      </div>
    </footer>
  )
}
