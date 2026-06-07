'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Phone, MapPin, Clock, MessageCircle, ExternalLink, Bus } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

const VIBER_DEEP = 'viber://chat?number=%2B959797272000'
const VIBER_MOBILE = 'https://invite.viber.com/?number=%2B959797272000'

function handleViberClick(e: React.MouseEvent) {
  e.preventDefault()
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  // On mobile: invite.viber.com detects the device, opens the app if installed,
  // or redirects to the App Store / Play Store if not — avoids iOS "Request Unavailable".
  // On desktop: deep link works when Viber desktop is installed.
  window.location.href = isMobile ? VIBER_MOBILE : VIBER_DEEP
}

export default function SiteFooter() {
  const { t, lang } = useLanguage()
  const my = lang === 'my' ? 'my' : ''
  const btnCls = 'flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-2 text-xs transition-colors hover:bg-white/20'
  return (
    <footer className="mt-12 bg-primary-dark px-5 py-8 text-white md:px-16 md:py-12">
      <div className="mx-auto max-w-6xl md:grid md:grid-cols-[7fr_4fr_9fr] md:gap-10">
        {/* Left: brand + contact */}
        <div>
          <Image src="/logo_white.jpg" alt="Mya Thida Futsal" width={884} height={856} className="h-8 w-auto object-contain" />
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
            <span className="flex items-center gap-2">
              <Bus size={13} />
              <span className="font-fbmono">2 · 3 · 6 · 60 · 133 · 144</span>
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href="tel:+959797272000" className={btnCls}>
              <Phone size={14} />
              <span className="font-fbmono">+95 9 797 272000</span>
            </a>
            <a href={VIBER_DEEP} onClick={handleViberClick} className={btnCls}>
              <MessageCircle size={14} />
              <span>Viber</span>
            </a>
            <a
              href="https://www.facebook.com/mtdfutsal"
              target="_blank"
              rel="noopener noreferrer"
              className={btnCls}
            >
              <ExternalLink size={14} />
              <span>Facebook</span>
            </a>
            <a
              href="https://maps.google.com/?q=Mya+Thida+Futsal+Field"
              target="_blank"
              rel="noopener noreferrer"
              className={`${btnCls} md:hidden`}
            >
              <MapPin size={14} />
              <span className={my}>{t('booking.footer.getDirections')}</span>
            </a>
          </div>
        </div>

        {/* Middle: quick links — desktop only */}
        <div className="hidden md:flex md:flex-col md:self-start">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide opacity-60">
            <span className={my}>{t('booking.footer.quickLinks')}</span>
          </p>
          <nav className="flex flex-col gap-2.5 text-sm">
            <Link href="/" className="opacity-70 transition-opacity hover:opacity-100">
              <span className={my}>{t('booking.nav.home')}</span>
            </Link>
            <Link href="/book" className="opacity-70 transition-opacity hover:opacity-100">
              <span className={my}>{t('booking.nav.book')}</span>
            </Link>
            <Link href="/news" className="opacity-70 transition-opacity hover:opacity-100">
              <span className={my}>{t('booking.nav.news')}</span>
            </Link>
            <Link href="/account" className="opacity-70 transition-opacity hover:opacity-100">
              <span className={my}>{t('booking.nav.account')}</span>
            </Link>
          </nav>
        </div>

        {/* Right: map embed — desktop only */}
        <div className="hidden md:flex md:flex-col md:self-start">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide opacity-60">
            <span className={my}>{t('booking.footer.findUs')}</span>
          </p>
          <div style={{ borderRadius: '8px', overflow: 'hidden', width: '100%', height: '300px' }}>
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3818.933074902053!2d96.26678117492148!3d16.829675883965503!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x30c18d5b8f51271b%3A0x7d25d15c3edb529e!2sMya%20Thida%20Futsal%20Field!5e0!3m2!1sen!2sth!4v1780281934835!5m2!1sen!2sth"
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              style={{ border: 0, width: '100%', height: '100%' }}
            />
          </div>
        </div>
      </div>
      <div className="mt-5 text-[11px] opacity-60">© 2026 Myathida Futsal · All rights reserved</div>
    </footer>
  )
}
