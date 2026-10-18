'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import ParkPhoto from '../ParkPhoto'
import OpenNow from './OpenNow'

export default function Hero() {
  const { t, lang } = useLanguage()

  return (
    <section className="overflow-hidden bg-park-mist">
      <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-4 pb-20 pt-10 md:px-8 md:pb-24 md:pt-14 lg:grid-cols-[5fr_7fr] lg:gap-14">
        <div className="flex flex-col gap-6">
          <p
            lang={lang === 'my' ? 'en' : 'my'}
            className="park-rise park-display text-xl text-park-jungle"
            style={{ animationDelay: '100ms' }}
          >
            {t('park.home.altName')}
          </p>
          <h1
            className={`park-rise park-display text-park-jungle ${
              lang === 'my'
                ? 'text-[34px] sm:text-5xl lg:text-[56px]'
                : 'max-w-[12ch] text-[44px] leading-[1.02] sm:text-6xl lg:text-[76px]'
            }`}
            style={{ animationDelay: '220ms' }}
          >
            {t('park.home.title')}
          </h1>
          <p className="park-rise max-w-[34ch] text-lg leading-relaxed text-park-ink-soft md:text-[19px]" style={{ animationDelay: '360ms' }}>
            {t('park.home.lead')}
          </p>
          <div className="park-rise flex flex-wrap gap-3" style={{ animationDelay: '480ms' }}>
            <Link
              href="#visit"
              className="inline-flex min-h-[48px] items-center rounded-full bg-park-sun px-6 font-bold text-park-ink transition-colors hover:bg-park-sun-deep"
            >
              {t('park.home.ctaVisit')}
            </Link>
            <Link
              href="#pool"
              className="inline-flex min-h-[48px] items-center rounded-full border-[1.5px] border-park-jungle px-6 font-semibold text-park-jungle transition-colors hover:bg-park-jungle hover:text-white"
            >
              {t('park.home.ctaExplore')}
            </Link>
          </div>
          <div className="park-rise" style={{ animationDelay: '600ms' }}>
            <OpenNow />
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[560px] lg:max-w-none">
          <ParkPhoto
            photo="heroPool"
            priority
            sizes="(min-width: 1024px) 640px, 92vw"
            className="park-unveil aspect-[4/5] rounded-[220px_220px_28px_28px] sm:aspect-square lg:aspect-[5/6]"
          />
          <ParkPhoto
            photo="heroMarket"
            sizes="240px"
            className="park-float absolute -bottom-6 left-0 aspect-square w-[38%] rounded-full border-8 border-park-mist sm:-left-8 lg:-left-10 lg:bottom-14"
          />
        </div>
      </div>
    </section>
  )
}
