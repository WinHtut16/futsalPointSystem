'use client'

import { Bus, MapPin, MessageCircle, Navigation, Phone } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { TranslationKey } from '@/lib/i18n'
import { HOURS, PARK, type VenueKey } from '@/lib/park/content'
import { formatHour } from '@/lib/park/time'
import ParkPhoto from '../ParkPhoto'
import ViberLink from '../ViberLink'

const ROWS: [VenueKey, TranslationKey][] = [
  ['pool', 'park.visit.pool'],
  ['market', 'park.visit.market'],
  ['futsal', 'park.visit.futsal'],
  ['games', 'park.visit.games'],
  ['billiards', 'park.visit.billiards'],
]

export default function Visit() {
  const { t, lang } = useLanguage()
  const address = lang === 'my' ? (PARK.addressMy ?? PARK.address) : PARK.address

  return (
    <section id="visit" aria-labelledby="park-visit" className="scroll-mt-32 bg-park-mist py-24 md:py-28">
      <div className="mx-auto grid max-w-[1200px] items-start gap-12 px-4 md:px-8 lg:grid-cols-[5fr_7fr] lg:gap-14">
        <div className="flex flex-col gap-6">
          <h2 id="park-visit" className="park-display text-[38px] leading-[1.1] text-park-jungle md:text-[46px]">
            {t('park.visit.title')}
          </h2>
          <p className="max-w-[40ch] text-[17px] leading-relaxed text-park-ink-soft">{t('park.visit.lead')}</p>
          {address && (
            <p className="flex items-start gap-2 text-[17px] text-park-ink">
              <MapPin size={20} aria-hidden="true" className="mt-1 shrink-0 text-park-jungle" />
              {address}
            </p>
          )}
          {PARK.busLines.length > 0 && (
            <p className="flex items-start gap-2 text-[17px] text-park-ink">
              <Bus size={20} aria-hidden="true" className="mt-1 shrink-0 text-park-jungle" />
              {t('park.visit.bus', { lines: PARK.busLines.join(', ') })}
            </p>
          )}

          <div>
            <h3 className="mb-1 font-semibold text-park-jungle">{t('park.visit.hours')}</h3>
            <dl className="divide-y divide-park-line">
              {ROWS.map(([venue, label]) => {
                const h = HOURS[venue]
                return (
                  <div key={venue} className="flex items-baseline justify-between gap-4 py-3">
                    <dt>{t(label)}</dt>
                    <dd className={h ? 'font-semibold' : 'text-park-ink-soft'}>
                      {h ? (
                        t('park.visit.range', { open: formatHour(h.open, lang), close: formatHour(h.close, lang) })
                      ) : (
                        <ViberLink className="underline decoration-park-line underline-offset-4 hover:text-park-jungle">
                          {t('park.visit.askUs')}
                        </ViberLink>
                      )}
                    </dd>
                  </div>
                )
              })}
            </dl>
          </div>

          <div className="flex flex-wrap gap-3">
            {PARK.mapsUrl && (
              <a
                href={PARK.mapsUrl}
                className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-park-jungle px-6 font-semibold text-white transition-colors hover:bg-park-jungle-deep"
                rel="noopener"
              >
                <Navigation size={18} aria-hidden="true" />
                {t('park.visit.directions')}
              </a>
            )}
            <ViberLink
              className={`inline-flex min-h-[48px] items-center gap-2 rounded-full px-6 font-semibold transition-colors ${
                PARK.mapsUrl
                  ? 'border-[1.5px] border-park-jungle text-park-jungle hover:bg-park-jungle hover:text-white'
                  : 'bg-park-jungle text-white hover:bg-park-jungle-deep'
              }`}
            >
              <MessageCircle size={18} aria-hidden="true" />
              {t('park.footer.viber')}
            </ViberLink>
            {PARK.phone && (
              <a
                href={`tel:${PARK.phone.replace(/\s/g, '')}`}
                className="inline-flex min-h-[48px] items-center gap-2 rounded-full border-[1.5px] border-park-jungle px-6 font-semibold text-park-jungle transition-colors hover:bg-park-jungle hover:text-white"
              >
                <Phone size={18} aria-hidden="true" />
                {t('park.footer.call', { phone: PARK.phone })}
              </a>
            )}
          </div>
        </div>

        {PARK.mapsEmbedUrl ? (
          <iframe
            src={PARK.mapsEmbedUrl}
            title={t('park.visit.mapTitle')}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="aspect-[4/3] w-full rounded-[28px] border-0"
          />
        ) : (
          <ParkPhoto photo="entrance" sizes="(min-width: 1024px) 680px, 92vw" className="aspect-[4/3] rounded-[28px]" />
        )}
      </div>
    </section>
  )
}
