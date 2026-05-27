'use client'

import Link from 'next/link'
import { Calendar, ArrowRight, Zap, Star, Shield, Sun } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import SiteNavbar from './SiteNavbar'
import BottomNav from './BottomNav'
import SiteFooter from './SiteFooter'
import PitchHero from './PitchHero'
import SectionLabel from './SectionLabel'
import { PricingTable } from './Pricing'
import NewsCardGrid, { type NewsPost } from './NewsCardGrid'

const FEATURES = [
  { Ic: Zap, titleKey: 'booking.home.featEasyTitle', bodyKey: 'booking.home.featEasyBody' },
  { Ic: Star, titleKey: 'booking.home.featPointsTitle', bodyKey: 'booking.home.featPointsBody' },
  { Ic: Shield, titleKey: 'booking.home.featFeesTitle', bodyKey: 'booking.home.featFeesBody' },
  { Ic: Sun, titleKey: 'booking.home.featOpenTitle', bodyKey: 'booking.home.featOpenBody' },
] as const

const STEPS = [
  { n: '01', titleKey: 'booking.home.step1Title', bodyKey: 'booking.home.step1Body' },
  { n: '02', titleKey: 'booking.home.step2Title', bodyKey: 'booking.home.step2Body' },
  { n: '03', titleKey: 'booking.home.step3Title', bodyKey: 'booking.home.step3Body' },
] as const

export default function HomeContent({ posts }: { posts: NewsPost[] }) {
  const { t, lang } = useLanguage()
  const my = lang === 'my' ? 'my' : ''

  return (
    <>
      <SiteNavbar active="home" />

      <PitchHero height={460} className="md:h-[520px]">
        <div className="relative flex h-full flex-col justify-end p-5 md:max-w-2xl md:justify-center md:p-16">
          <div className={`font-display text-[10px] font-bold uppercase tracking-[0.16em] text-accent md:text-xs ${my}`}>
            {t('booking.home.heroKicker')}
          </div>
          <h1 className={`my-3 font-display font-extrabold tracking-tight ${
            lang === 'my'
              ? 'text-3xl leading-relaxed my'
              : 'text-4xl leading-[1.05] md:text-6xl'
          }`}>
            {t('booking.home.heroTitle')}
          </h1>
          <p className={`max-w-md text-sm leading-relaxed opacity-90 md:text-base ${my}`}>
            {t('booking.home.heroSub')}
          </p>
          <div className="mt-5">
            <Link href="/book" className="fb-btn fb-btn-primary w-full md:w-auto md:!px-10 md:!py-4 !text-[15px]">
              <Calendar size={16} /> <span className={my}>{t('booking.nav.book')}</span> <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </PitchHero>

      <div className="mx-auto max-w-6xl">
        {/* Features */}
        <section className="px-5 pt-6 md:px-16 md:pt-16">
          <SectionLabel kicker={t('booking.home.whyKicker')} />
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-4">
            {FEATURES.map(({ Ic, titleKey, bodyKey }) => (
              <div key={titleKey} className="fb-card p-3.5 md:p-6">
                <div className="mb-2.5 flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary md:h-11 md:w-11">
                  <Ic size={16} />
                </div>
                <div className={`mb-1 font-display text-[13px] font-bold text-ink-primary md:text-base ${my}`}>
                  {t(titleKey)}
                </div>
                <div className={`text-[11px] leading-snug text-ink-muted md:text-[13px] ${my}`}>{t(bodyKey)}</div>
              </div>
            ))}
          </div>
        </section>

        {/* How it works + pricing */}
        <section className="px-5 pt-7 md:grid md:grid-cols-[1.2fr_1fr] md:gap-8 md:px-16 md:pt-16">
          <div>
            <SectionLabel kicker={t('booking.home.howKicker')} title={t('booking.home.howTitle')} />
            <div className="flex flex-col gap-2.5">
              {STEPS.map(({ n, titleKey, bodyKey }, i) => (
                <div key={n} className="fb-card flex items-start gap-3.5 p-3.5 md:gap-5 md:p-5">
                  <div className="w-11 shrink-0 font-display text-3xl font-extrabold leading-none tracking-tighter text-primary md:w-16 md:text-5xl">
                    {n}
                  </div>
                  <div className="flex-1">
                    <div className={`font-display font-bold text-ink-primary md:text-lg ${my}`}>{t(titleKey)}</div>
                    <div className={`mt-0.5 text-xs text-ink-muted md:text-sm ${my}`}>{t(bodyKey)}</div>
                  </div>
                  {i < 2 && <ArrowRight size={18} className="hidden self-center text-ink-faint md:block" />}
                </div>
              ))}
            </div>
          </div>
          <div className="pt-7 md:pt-0">
            <SectionLabel kicker={t('booking.pricing.title')} title={t('booking.pricing.sub')} />
            <PricingTable />
          </div>
        </section>

        {/* News */}
        <section className="px-5 pt-7 md:px-16 md:pt-16">
          <SectionLabel
            kicker={t('booking.news.title')}
            title={t('booking.news.whatsOn')}
            action={t('booking.news.viewAll')}
            href="/news"
          />
          <NewsCardGrid posts={posts} columns={3} />
        </section>

        <div className="hidden md:block">
          <SiteFooter />
        </div>
      </div>

      {/* Mobile footer (outside max-width for full-bleed bg) */}
      <div className="md:hidden">
        <SiteFooter />
      </div>

      <BottomNav active="home" />
    </>
  )
}
