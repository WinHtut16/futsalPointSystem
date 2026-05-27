'use client'

import { Phone, MapPin, Clock, MessageCircle } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import Logo from './Logo'

export default function SiteFooter() {
  const { t, lang } = useLanguage()
  const my = lang === 'my' ? 'my' : ''
  return (
    <footer className="mt-12 bg-primary-dark px-5 py-8 text-white md:px-16 md:py-12">
      <div className="mx-auto max-w-6xl md:grid md:grid-cols-[2fr_1fr_1fr] md:gap-10">
        <div>
          <Logo size={30} color="#fff" />
          <div className="mt-3.5 flex flex-col gap-2 text-xs opacity-85">
            <span className="flex items-center gap-2">
              <Phone size={13} /> <span className="font-fbmono">+95 9 797 272000</span>
            </span>
            <span className="flex items-center gap-2">
              <MapPin size={13} /> <span className={my}>{t('booking.book.location')}</span>
            </span>
            <span className="flex items-center gap-2">
              <Clock size={13} /> <span className={my}>{t('booking.home.openHours')}</span>
            </span>
          </div>
          <div className="mt-4 flex gap-2">
            <a
              href="tel:+959797272000"
              className="flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-2 text-xs transition-colors hover:bg-white/20"
            >
              <Phone size={14} />
              <span className="font-fbmono">+95 9 797 272000</span>
            </a>
            <a
              href="viber://chat?number=%2B959797272000"
              className="flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-2 text-xs transition-colors hover:bg-white/20"
            >
              <MessageCircle size={14} />
              <span>Viber</span>
            </a>
          </div>
        </div>
      </div>
      <div className="mt-5 text-[11px] opacity-60">© 2026 Myathida Futsal · All rights reserved</div>
    </footer>
  )
}
