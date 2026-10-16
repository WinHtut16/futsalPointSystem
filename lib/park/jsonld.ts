import { HOURS, PARK, FUTSAL_RATES, GAME, type Hours } from './content'
import { SITE_URL } from './site'

// schema.org description of the park for search engines. Built from
// lib/park/content.ts so it never states a fact the page doesn't; fields the
// client hasn't supplied are simply left out.

const pad = (h: number) => `${String(h % 24).padStart(2, '0')}:00`
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function openingHours(h: Hours | null) {
  return h ? [{ '@type': 'OpeningHoursSpecification', dayOfWeek: DAYS, opens: pad(h.open), closes: pad(h.close) }] : undefined
}

export function parkJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'AmusementPark',
    name: 'MyaThida Park',
    alternateName: 'မြသီတာ ပန်းခြံ',
    url: SITE_URL,
    logo: `${SITE_URL}/logo_black.jpg`,
    description:
      'A family park in Myanmar with a swimming pool, poolside restaurant, futsal court, game shop and billiards.',
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
        name: 'MyaThida Game Shop',
        url: `${SITE_URL}/games`,
        openingHoursSpecification: openingHours(HOURS.games),
        priceRange: `${GAME.rates.ps4}-${GAME.rates.vip} MMK per hour`,
      },
      {
        '@type': 'EntertainmentBusiness',
        name: 'MyaThida Billiards',
        url: `${SITE_URL}/billiards`,
        openingHoursSpecification: openingHours(HOURS.billiards),
      },
      { '@type': 'PublicSwimmingPool', name: 'MyaThida Pool', openingHoursSpecification: openingHours(HOURS.pool) },
      { '@type': 'Restaurant', name: 'MyaThida Poolside Restaurant', openingHoursSpecification: openingHours(HOURS.restaurant) },
    ],
  }
}
