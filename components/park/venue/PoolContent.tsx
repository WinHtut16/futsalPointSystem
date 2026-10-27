'use client'

import { Cctv, MoveVertical, Ruler } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { HOURS, POOL } from '@/lib/park/content'
import { closedDaysLabel, formatAmount, hoursRange } from '@/lib/park/time'
import ViberLink from '../ViberLink'
import PoolDepth from './pool/PoolDepth'
import PoolRules from './pool/PoolRules'
import PoolStatus from './pool/PoolStatus'
import { PriceRows, VenueHero, VenueStrip, type Theme } from './VenueParts'

// Daylight and water: the hero is the pool's own teal, the depth section
// drops into deep water, and the rules sit on the tiled deck.
const theme: Theme = {
  ground: 'bg-park-pool text-park-ink',
  panel: 'bg-[#0c3b45] text-white',
  muted: 'text-park-ink',
  accent: 'text-park-jungle',
  rule: 'divide-park-line border-park-line',
  primaryBtn: 'bg-park-ink text-white hover:bg-park-jungle-deep',
  secondaryBtn: 'border-[1.5px] border-park-ink text-park-ink hover:bg-white/25',
}

export default function PoolContent() {
  const { t, lang } = useLanguage()
  const n = (v: number) => formatAmount(v, lang)
  const hours = HOURS.pool
  const closed = hours && closedDaysLabel(hours, t)

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
        photo="poolSwim"
        badge={<PoolStatus />}
        primary={{ href: '#rules', label: 'park.pool.ctaRules' }}
        secondary={{ href: '/#food', label: 'park.pool.ctaFood' }}
        glow="shadow-[0_30px_90px_rgb(11_58_70/0.35)]"
      />

      <section aria-labelledby="pool-entry" className="bg-park-mist py-20 md:py-24">
        <div className="mx-auto grid max-w-[1200px] gap-14 px-4 md:px-8 lg:grid-cols-[7fr_5fr] lg:gap-20">
          <div>
            <h2 id="pool-entry" className="park-display text-[34px] leading-[1.1] text-park-jungle md:text-[42px]">
              {t('park.pool.entryTitle')}
            </h2>
            <div className="mt-6 max-w-[520px]">
              <PriceRows
                theme={theme}
                unit="park.pool.perEntry"
                rows={[
                  ['park.pool.adult', POOL.prices.adult],
                  ['park.pool.child', POOL.prices.child],
                ]}
              />
            </div>
            <p className="mt-4 max-w-[52ch] text-park-ink-soft">
              <ViberLink className="underline decoration-park-line underline-offset-4 hover:text-park-jungle">
                {t('park.pool.entryNote')}
              </ViberLink>
            </p>
          </div>

          {hours && (
            <div className="flex flex-col gap-2 border-t border-park-line pt-8 lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0">
              <h2 className="font-semibold text-park-jungle">{t('park.pool.hoursTitle')}</h2>
              <p className="park-display text-3xl leading-tight text-park-ink md:text-[38px]">{hoursRange(hours, t, lang)}</p>
              {closed && (
                <p className="inline-flex w-fit items-center gap-2 rounded-full bg-[#b42318]/10 px-3 py-1 font-semibold text-[#9a1d14]">
                  {closed}
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="pool-depth" className={`${theme.panel} py-20 md:py-24`}>
        <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-4 md:px-8 lg:grid-cols-[5fr_7fr] lg:gap-14">
          <div className="flex flex-col gap-5">
            <h2 id="pool-depth" className="park-display max-w-[18ch] text-[34px] leading-[1.1] md:text-[42px]">
              {t('park.pool.depthTitle')}
            </h2>
            <p className="max-w-[44ch] text-[17px] leading-relaxed text-[#cfeaee]">{t('park.pool.depthBody')}</p>
            <dl className="mt-2 divide-y divide-white/15 border-y border-white/15">
              {facts.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-4 py-3.5">
                  <Icon size={22} aria-hidden="true" className="mt-0.5 shrink-0 text-park-sun" />
                  <dt className="w-24 shrink-0 font-semibold">{label}</dt>
                  <dd className="text-[#cfeaee]">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <PoolDepth />
        </div>
      </section>

      <section id="rules" aria-labelledby="pool-rules" className="pool-tiles scroll-mt-32 bg-park-mist py-20 md:py-24">
        <div className="mx-auto max-w-[1200px] px-4 md:px-8">
          <h2 id="pool-rules" className="park-display text-[34px] leading-[1.1] text-park-jungle md:text-[42px]">
            {t('park.pool.rulesTitle')}
          </h2>
          <p className="mt-3 max-w-[52ch] text-[17px] text-park-ink-soft">{t('park.pool.rulesLead')}</p>
          <div className="mt-10">
            <PoolRules />
          </div>
        </div>
      </section>

      <VenueStrip
        band="bg-park-pool text-park-ink"
        hours={hours}
        also={{ href: '/#food', label: 'park.pool.alsoFood' }}
      />
    </>
  )
}
