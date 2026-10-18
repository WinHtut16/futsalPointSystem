'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { TranslationKey } from '@/lib/i18n'
import { FUTSAL_RATES, GAME, BILLIARDS, HOURS, billiardsOpening } from '@/lib/park/content'
import { formatAmount, formatHour } from '@/lib/park/time'
import type { PhotoKey } from '@/lib/park/photos'
import LivePhoto, { type PhotoLight } from '../LivePhoto'
import RollIn from '../RollIn'
import VenueIcon, { type VenueIconKind } from '../VenueIcon'
import OpeningBadge from '../OpeningBadge'
import { TableSvg } from '../venue/BreakTable'
import DaySky from './DaySky'

// The landing's spine: one real day at the park, morning to night. Each
// stretch of the day has its own ground colour, and a horizon band blends
// one into the next, so scrolling the page reads as the day passing.

function Horizon({ from, to }: { from: string; to: string }) {
  return (
    <div
      aria-hidden="true"
      className="park-horizon"
      style={{ ['--from' as string]: `rgb(var(${from}))`, ['--to' as string]: `rgb(var(${to}))` }}
    />
  )
}

function Moment({
  id,
  time,
  timeClass,
  title,
  titleClass = 'text-park-jungle',
  body,
  bodyClass = 'text-park-ink-soft',
  photo,
  icon,
  hour,
  light,
  reverse = false,
  children,
}: {
  id?: string
  /** Clock hour this moment stands for; DaySky anchors the sun to it. */
  hour: number
  /** Colour of the light that follows the pointer over the photo. */
  light: PhotoLight
  icon: VenueIconKind
  time: TranslationKey
  timeClass: string
  title: TranslationKey
  titleClass?: string
  body: React.ReactNode
  bodyClass?: string
  photo: PhotoKey
  reverse?: boolean
  children?: React.ReactNode
}) {
  const { t } = useLanguage()
  const [hover, setHover] = useState(false)
  return (
    <div
      id={id}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      className={`mx-auto grid max-w-[1200px] scroll-mt-32 items-center gap-8 px-4 md:px-8 lg:gap-14 ${
        reverse ? 'lg:grid-cols-[7fr_5fr]' : 'lg:grid-cols-[5fr_7fr]'
      }`}
    >
      <div className={`flex flex-col gap-5 ${reverse ? 'lg:order-2' : ''}`}>
        <div className="flex items-center gap-4">
          <VenueIcon kind={icon} hover={hover} />
          <p data-day-hour={hour} className={`park-display text-6xl leading-none md:text-[84px] ${timeClass}`}><RollIn>{t(time)}</RollIn></p>
        </div>
        <h2 className={`park-display max-w-[18ch] text-[34px] leading-[1.1] md:text-[42px] ${titleClass}`}>{t(title)}</h2>
        <p className={`max-w-[44ch] text-[17px] leading-relaxed ${bodyClass}`}>{body}</p>
        {children}
      </div>
      <LivePhoto
        photo={photo}
        light={light}
        sizes="(min-width: 1024px) 680px, 92vw"
        wrapClass={reverse ? 'lg:order-1' : ''}
        className="aspect-[16/11] rounded-[28px]"
      />
    </div>
  )
}

export default function DayStory() {
  const { t, lang } = useLanguage()
  const story = useRef<HTMLDivElement>(null)
  const futsal = HOURS.futsal
  const mmk = (n: number) => formatAmount(n, lang)

  const rates: [TranslationKey, number][] = [
    ['park.day.afternoon.rateMorning', FUTSAL_RATES.weekdayMorning],
    ['park.day.afternoon.rateEvening', FUTSAL_RATES.weekdayAfternoon],
    ['park.day.afternoon.rateWeekend', FUTSAL_RATES.weekendHoliday],
  ]

  return (
    <div ref={story} aria-label={t('park.day.label')} role="region">
      <DaySky root={story} />
      <Horizon from="--park-mist" to="--park-noon" />

      <section className="bg-park-noon pb-24 md:pb-32">
        <Moment
          id="pool"
          time="park.day.morning.time"
          timeClass="text-[#a66f00]"
          title="park.day.morning.title"
          body={t('park.day.morning.body')}
          photo="poolSwim"
          icon="pool"
          hour={8}
          light="water"
        />
        <div className="h-24 md:h-32" />
        <Moment
          time="park.day.noon.time"
          timeClass="text-[#b06000]"
          title="park.day.noon.title"
          body={t('park.day.noon.body')}
          photo="poolDining"
          icon="food"
          hour={12.5}
          light="warm"
          reverse
        />
      </section>

      <Horizon from="--park-noon" to="--park-afternoon" />

      <section className="bg-park-afternoon pb-24 md:pb-32">
        <Moment
          id="futsal"
          time="park.day.afternoon.time"
          timeClass="text-[#b8501a]"
          title="park.day.afternoon.title"
          titleClass="text-venue-futsal"
          body={t('park.day.afternoon.body', {
            open: futsal ? formatHour(futsal.open, lang) : '',
            close: futsal ? formatHour(futsal.close, lang) : '',
            deposit: mmk(FUTSAL_RATES.deposit),
          })}
          bodyClass="text-[#3a3a24]"
          photo="futsal"
          icon="futsal"
          hour={16}
          light="warm"
        >
          <dl className="max-w-[440px] divide-y divide-venue-futsal/15 text-base">
            {rates.map(([label, price]) => (
              <div key={label} className="flex items-baseline justify-between gap-4 py-2.5">
                <dt className="text-[#3a3a24]">{t(label)}</dt>
                <dd className="whitespace-nowrap font-bold text-venue-futsal">
                  {t('park.day.afternoon.perHour', { price: mmk(price) })}
                </dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link
              href="/book"
              className="inline-flex min-h-[48px] items-center rounded-full bg-venue-futsal px-6 font-semibold text-white transition-colors hover:bg-park-jungle-deep"
            >
              {t('park.day.afternoon.book')}
            </Link>
            <Link
              href="/futsal"
              className="inline-flex min-h-[48px] items-center rounded-full border-[1.5px] border-venue-futsal px-6 font-semibold text-venue-futsal transition-colors hover:bg-venue-futsal hover:text-white"
            >
              {t('park.day.afternoon.more')}
            </Link>
          </div>
        </Moment>
      </section>

      <Horizon from="--park-afternoon" to="--park-dusk" />

      <section id="evening" aria-labelledby="park-evening" className="scroll-mt-32 bg-park-dusk pb-24 text-[#eaf0f7] md:pb-28">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-12 px-4 md:px-8">
          <div className="flex max-w-[640px] flex-col gap-4">
            <p data-day-hour={19.5} className="park-display text-6xl leading-none text-park-sun md:text-[84px]">
              <RollIn>{t('park.day.evening.time')}</RollIn>
            </p>
            <h2 id="park-evening" className="park-display text-[34px] leading-[1.1] md:text-[42px]">
              {t('park.day.evening.title')}
            </h2>
            <p className="text-[17px] leading-relaxed text-[#c3cfe0]">{t('park.day.evening.body')}</p>
          </div>

          <MarketLane />

          <div className="grid gap-6 md:grid-cols-2">
            <VenueCard
              href="/games"
              icon="games"
              media={<LivePhoto photo="gameRoom" light="lights" sizes="(min-width: 768px) 560px, 92vw" className="aspect-[16/9] rounded-[18px]" />}
              title={t('park.day.evening.gamesTitle')}
              body={t('park.day.evening.gamesBody')}
              meta={t('park.day.evening.gamesFrom', { price: mmk(GAME.rates.ps4) })}
              card="bg-[#23386a] hover:bg-[#28407a]"
              metaClass="text-venue-amber"
              bodyClass="text-[#c3cfe0]"
            />
            <VenueCard
              href="/billiards"
              icon="billiards"
              // No photos until the room opens: the drawn table stands in.
              media={
                <div className="flex aspect-[16/9] items-center justify-center rounded-[18px] bg-[#1f1214] p-6">
                  <TableSvg className="w-full max-w-[420px]" />
                </div>
              }
              title={t('park.day.evening.billiardsTitle')}
              body={t('park.day.evening.billiardsBody')}
              meta={
                billiardsOpening() ? (
                  <OpeningBadge />
                ) : BILLIARDS.ratePerHour ? (
                  t('park.day.evening.billiardsRate', { price: mmk(BILLIARDS.ratePerHour) })
                ) : (
                  t('park.day.evening.billiardsSee')
                )
              }
              card="bg-[#3a2230] hover:bg-[#452838]"
              metaClass="text-venue-brass"
              bodyClass="text-[#e2ccd2]"
            />
          </div>
        </div>
      </section>

      <Horizon from="--park-dusk" to="--park-night" />
    </div>
  )
}

// The market lane has no page of its own, so it is a feature row rather
// than a link card: photo and text side by side, set apart from the two rooms.
function MarketLane() {
  const { t } = useLanguage()
  const [hover, setHover] = useState(false)
  return (
    <article
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      className="grid items-center gap-6 rounded-[28px] bg-[#162440] p-5 md:grid-cols-[7fr_5fr] md:gap-10 md:p-6"
    >
      <LivePhoto photo="marketLane" light="lights" sizes="(min-width: 768px) 640px, 92vw" className="aspect-[16/9] rounded-[18px]" />
      <div className="flex flex-col gap-3">
        <h3 className="park-display flex items-center gap-3 text-3xl">
          <VenueIcon kind="market" hover={hover} size={44} />
          {t('park.day.evening.marketTitle')}
        </h3>
        <p className="font-semibold text-park-sun">{t('park.day.evening.marketMeta')}</p>
        <p className="leading-relaxed text-[#c3cfe0]">{t('park.day.evening.marketBody')}</p>
      </div>
    </article>
  )
}

function VenueCard({
  href,
  icon,
  media,
  title,
  body,
  meta,
  card,
  metaClass,
  bodyClass,
}: {
  href: string
  icon: VenueIconKind
  media: React.ReactNode
  title: string
  body: string
  meta: React.ReactNode
  card: string
  metaClass: string
  bodyClass: string
}) {
  const [hover, setHover] = useState(false)
  return (
    <Link
      href={href}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      className={`group flex flex-col gap-4 rounded-[28px] p-5 transition-colors ${card}`}
    >
      {media}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h3 className="park-display flex items-center gap-3 text-3xl">
          <VenueIcon kind={icon} hover={hover} size={44} />
          {title}
        </h3>
        <span className={`font-semibold ${metaClass}`}>{meta}</span>
      </div>
      <p className={`leading-relaxed ${bodyClass}`}>{body}</p>
    </Link>
  )
}
