'use client'

import Link from 'next/link'
import { Cctv, MoveVertical, Ruler, UtensilsCrossed } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { FOOD_HOUSE, HOURS, POOL } from '@/lib/park/content'
import { formatAmount, hoursRange } from '@/lib/park/time'
import ParkPhoto from '../ParkPhoto'
import PoolDepth from './pool/PoolDepth'
import PoolRules from './pool/PoolRules'
import PoolHeroPhotos from './pool/PoolHeroPhotos'
import PoolStatus from './pool/PoolStatus'
import PoolTicket from './pool/PoolTicket'
import { VenueHero, VenueStrip, type Theme } from './VenueParts'

// Colours taken from the pool itself (sampled from the client's photos):
// the white mosaic deck as the ground, the terracotta entry steps as the
// accent, and the navy pool liner for the depth section.
const INK = 'text-[#1a1d1f]'
const theme: Theme = {
  ground: `pool-tiles ${INK}`,
  panel: 'bg-[#16305c] text-white',
  muted: 'text-[#3b4045]',
  accent: 'text-[#a8453a]',
  rule: 'divide-[#dcdcd8] border-[#dcdcd8]',
  primaryBtn: 'bg-[#a8453a] text-white hover:bg-[#8a362c]',
  secondaryBtn: 'border-[1.5px] border-[#1a1d1f] text-[#1a1d1f] hover:bg-black/5',
}
const heading = `park-display text-[34px] leading-[1.1] md:text-[42px] ${INK}`

export default function PoolContent() {
  const { t, lang } = useLanguage()
  const n = (v: number) => formatAmount(v, lang)
  const hours = HOURS.pool

  const facts = [
    {
      icon: MoveVertical,
      label: t('park.pool.depth'),
      value: t('park.pool.depthValue', {
        shallow: n(POOL.depthFt.shallow),
        deep: n(POOL.depthFt.deep),
        deepM: n(POOL.deepM),
      }),
    },
    {
      icon: Ruler,
      label: t('park.pool.size'),
      value: t('park.pool.sizeValue', {
        length: n(POOL.sizeFt.length),
        width: n(POOL.sizeFt.width),
        lengthM: n(POOL.sizeM.length),
        widthM: n(POOL.sizeM.width),
      }),
    },
    ...(POOL.cctv ? [{ icon: Cctv, label: t('park.pool.cctv'), value: t('park.pool.cctvValue') }] : []),
  ]

  return (
    <>
      <VenueHero
        theme={theme}
        title="park.pool.title"
        lead="park.pool.lead"
        media={<PoolHeroPhotos />}
        badge={<PoolStatus />}
        extra={<PoolTicket />}
        primary={{ href: '#rules', label: 'park.pool.ctaRules' }}
        secondary={{ href: '#food', label: 'park.pool.ctaFood' }}
        glow=""
      />

      <section aria-labelledby="pool-depth" className={`${theme.panel} py-20 md:py-24`}>
        <div className="mx-auto max-w-[1200px] px-4 md:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-[5fr_6fr] lg:gap-16">
            <div className="flex flex-col gap-5">
              <h2 id="pool-depth" className="park-display max-w-[18ch] text-[34px] leading-[1.1] md:text-[42px]">
                {t('park.pool.depthTitle')}
              </h2>
              <p className="max-w-[44ch] text-[17px] leading-relaxed text-[#d4def0]">{t('park.pool.depthBody')}</p>
              <dl className="mt-2 divide-y divide-white/15 border-y border-white/15">
                {facts.map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-start gap-4 py-3.5">
                    <Icon size={22} aria-hidden="true" className="mt-0.5 shrink-0 text-park-sun" />
                    <dt className="w-24 shrink-0 font-semibold">{label}</dt>
                    <dd className="text-[#d4def0]">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <PoolDepth className="mx-auto block max-w-[560px]" />
          </div>
        </div>
      </section>

      <section id="rules" aria-labelledby="pool-rules" className="pool-tiles scroll-mt-24 py-20 md:py-24">
        <div className="mx-auto max-w-[1200px] px-4 md:px-8">
          <h2 id="pool-rules" className={heading}>
            {t('park.pool.rulesTitle')}
          </h2>
          <p className="mt-3 max-w-[52ch] text-[17px] text-[#3b4045]">{t('park.pool.rulesLead')}</p>
          <div className="mt-10">
            <PoolRules />
          </div>
        </div>
      </section>

      <section id="food" aria-labelledby="pool-food" className="scroll-mt-24 bg-white py-20 md:py-24">
        <div className="mx-auto grid max-w-[1200px] items-center gap-10 px-4 md:px-8 lg:grid-cols-[7fr_5fr] lg:gap-14">
          <ParkPhoto photo="poolFood" sizes="(min-width: 1024px) 680px, 92vw" className="aspect-[4/3] rounded-[28px]" />
          <div className="flex flex-col gap-5">
            <p className="flex items-center gap-2 font-semibold text-[#a8453a]">
              <UtensilsCrossed size={18} aria-hidden="true" />
              {FOOD_HOUSE.name}
            </p>
            <h2 id="pool-food" className={heading}>
              {t('park.pool.foodTitle')}
            </h2>
            <p className="max-w-[44ch] text-[17px] leading-relaxed text-[#3b4045]">{t('park.pool.foodBody')}</p>
            {HOURS.food && (
              <p className={`font-semibold ${INK}`}>
                {t('park.venue.openDaily', { range: hoursRange(HOURS.food, t, lang) })}
              </p>
            )}
            <Link
              href="/#food"
              className="inline-flex min-h-[48px] w-fit items-center rounded-full bg-[#a8453a] px-6 font-semibold text-white transition-colors hover:bg-[#8a362c]"
            >
              {t('park.pool.foodCta')}
            </Link>
          </div>
        </div>
      </section>

      <VenueStrip
        band="bg-[#a8453a] text-white"
        hours={hours}
        also={{ href: '/futsal', label: 'park.pool.alsoFutsal' }}
      />
    </>
  )
}
