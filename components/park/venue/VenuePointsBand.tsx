'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { VENUE_PORTAL, type Venue } from '@/lib/venue-account'

/**
 * "My points" entry on a venue page. Static on purpose (the park pages read no
 * session): signed-out visitors are sent to log in and come back to the portal.
 */
export default function VenuePointsBand({
  venue,
  className,
  buttonClass,
  mutedClass,
}: {
  venue: Venue
  className: string
  buttonClass: string
  mutedClass: string
}) {
  const { t, lang } = useLanguage()
  const my = lang === 'my' ? 'my' : ''
  return (
    <section aria-labelledby={`${venue}-points`} className={`${className} py-10`}>
      <div className="mx-auto flex max-w-[1200px] flex-col items-start gap-4 px-4 md:flex-row md:items-center md:justify-between md:px-8">
        <div className="flex flex-col gap-1">
          <h2 id={`${venue}-points`} className={`park-display text-[24px] leading-tight md:text-[28px] ${my}`}>
            {t('venue.band.title')}
          </h2>
          <p className={`max-w-[52ch] text-[15px] leading-relaxed ${mutedClass} ${my}`}>{t('venue.band.body')}</p>
        </div>
        <Link
          href={VENUE_PORTAL[venue]}
          className={`inline-flex min-h-[44px] shrink-0 items-center rounded-full px-6 text-[15px] font-semibold transition-colors ${buttonClass} ${my}`}
        >
          {t('venue.myPoints')}
        </Link>
      </div>
    </section>
  )
}
