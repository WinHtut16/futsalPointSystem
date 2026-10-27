import { HOURS, PARK, POOL, FOOD_HOUSE, FUTSAL_RATES, GAME, billiardsOpening, type Hours } from './content'
import { SITE_URL } from './site'

// schema.org description of the park for search engines. Built from
// lib/park/content.ts so it never states a fact the page doesn't; fields the
// client hasn't supplied are simply left out.

// 17.5 -> "17:30"; a 24:00 close is written 23:59 as schema.org expects.
const pad = (h: number) => {
  const mins = Math.min(Math.round(h * 60), 24 * 60 - 1)
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
}
// Indexed like Date.getDay(): 0 = Sunday.
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function openingHours(h: Hours | null) {
  if (!h) return undefined
  const dayOfWeek = DAYS.filter((_, i) => !h.closedDays?.includes(i))
  return [{ '@type': 'OpeningHoursSpecification', dayOfWeek, opens: pad(h.open), closes: pad(h.close) }]
}

export function parkJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'AmusementPark',
    name: 'MyaThida Park',
    alternateName: 'မြသီတာ ပန်းခြံ',
    url: SITE_URL,
    openingHoursSpecification: openingHours(HOURS.park),
    logo: `${SITE_URL}/logo_black.jpg`,
    description:
      'A family park in Yangon with a covered pool, poolside dining, a night market lane, a futsal court, ACJ Gaming and billiards.',
    ...(PARK.address ? { address: { '@type': 'PostalAddress', streetAddress: PARK.address, addressCountry: 'MM' } } : {}),
    ...(PARK.phone ? { telephone: PARK.phone } : {}),
    ...(PARK.mapsUrl ? { hasMap: PARK.mapsUrl } : {}),
    ...(PARK.facebookUrl ? { sameAs: [PARK.facebookUrl] } : {}),
    containsPlace: [
      {
        '@type': 'SportsActivityLocation',
        name: 'MyaThida Futsal',
        url: `${SITE_URL}/futsal`,
        openingHoursSpecification: openingHours(HOURS.futsal),
        priceRange: `${FUTSAL_RATES.weekdayMorning}-${FUTSAL_RATES.weekendHoliday} MMK per hour`,
      },
      {
        '@type': 'EntertainmentBusiness',
        name: 'ACJ Gaming',
        url: `${SITE_URL}/games`,
        logo: `${SITE_URL}/images/acj/acj-lockup-mint.png`,
        openingHoursSpecification: openingHours(HOURS.games),
        priceRange: `${GAME.rates.ps4}-${GAME.rates.vip} MMK per hour`,
      },
      // Billiards is listed only once it has opened.
      ...(billiardsOpening()
        ? []
        : [
            {
              '@type': 'EntertainmentBusiness',
              name: 'CueX Billiard and Snooker Club',
              url: `${SITE_URL}/billiards`,
              openingHoursSpecification: openingHours(HOURS.billiards),
            },
          ]),
      {
        '@type': 'PublicSwimmingPool',
        name: 'Mini Water Boom',
        url: `${SITE_URL}/pool`,
        openingHoursSpecification: openingHours(HOURS.pool),
        priceRange: `${POOL.prices.child}-${POOL.prices.adult} MMK per entry`,
      },
      {
        '@type': 'Restaurant',
        name: FOOD_HOUSE.name,
        url: `${SITE_URL}/#food`,
        hasMenu: FOOD_HOUSE.menuUrl,
        openingHoursSpecification: openingHours(HOURS.food),
      },
      { '@type': 'FoodEstablishment', name: 'MyaThida Market Lane', openingHoursSpecification: openingHours(HOURS.market) },
    ],
  }
}
