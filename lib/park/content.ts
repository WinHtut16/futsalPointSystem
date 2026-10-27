// Park showcase facts. Language-neutral data only (numbers, hours, links);
// every visible sentence lives in lib/i18n/namespaces/park.ts.
//
// `null` means the client has not supplied it yet (see
// docs/park/client-content-checklist.md). Components must hide a row whose
// value is null rather than print a placeholder.

export type VenueKey = 'park' | 'pool' | 'food' | 'futsal' | 'games' | 'billiards' | 'market'

/** Opening hours in Myanmar time as 24h numbers; halves are allowed (17.5 = 5:30 PM).
 *  `closedDays` lists weekdays the venue is shut (0 = Sunday, 1 = Monday ...).
 *  { open: 0, close: 24 } means always open. */
export type Hours = { open: number; close: number; closedDays?: readonly number[] }

// Contact details are the futsal site's (components/booking/SiteFooter.tsx);
// the park and the court share one front desk.
export const PARK = {
  // From the client's map pin (2026-10-28), plus code R7H9+VPH.
  address: 'Kyun Shwe Wah Road, Yuzana Garden City, Dagon Seikkan Township, Yangon' as string | null,
  // Burmese spelling of the street and estate not confirmed yet: null shows
  // the English address to Burmese readers too.
  addressMy: null as string | null,
  mapsUrl: 'https://maps.google.com/?q=Mya+Thida+Futsal+Field' as string | null,
  // Google Maps embed (Share > Embed a map). CSP frame-src allows www.google.com.
  mapsEmbedUrl:
    'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3818.933074902053!2d96.26678117492148!3d16.829675883965503!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x30c18d5b8f51271b%3A0x7d25d15c3edb529e!2sMya%20Thida%20Futsal%20Field!5e0!3m2!1sen!2sth!4v1780281934835!5m2!1sen!2sth' as
      | string
      | null,
  phone: '+95 9 797 272000' as string | null,
  facebookUrl: 'https://www.facebook.com/mtdfutsal' as string | null,
  busLines: ['2', '3', '6', '60', '133', '144'],
  // Same Viber deep link the futsal site uses (CLAUDE.md: never a web URL).
  // Links should call openViber() from lib/viber.ts, which handles iOS.
  viberUrl: 'viber://chat?number=%2B959797272000',
}

// Client-confirmed hours, 2026-10-27.
export const HOURS: Record<VenueKey, Hours | null> = {
  park: { open: 6, close: 19 },
  pool: { open: 9, close: 17.5, closedDays: [1] },
  food: { open: 6, close: 22 },
  // lib/booking.ts dayHours: 16 slots, 06:00 to 21:00, last slot ends 22:00.
  futsal: { open: 6, close: 22 },
  games: { open: 9, close: 20 },
  billiards: { open: 9, close: 20 },
  market: { open: 0, close: 24 },
}

/** The poolside restaurant. The menu is a Google Drive file the client
 *  maintains; menuQr is their printed table card, which encodes the same file. */
export const FOOD_HOUSE = {
  name: 'Family Garden Food House',
  menuUrl: 'https://drive.google.com/file/d/19oPE_fRo0yF5M64cig6Rl1-tMymLNP5d/view',
  menuQr: '/images/park/family-garden-menu-qr.png',
}

/** Mini Water Boom, from the client 2026-10-27. Entry is per person, not hourly.
 *  The shallow-end depth is the client's estimate. */
export const POOL = {
  prices: { adult: 10000, child: 7000 },
  depthFt: { shallow: 1, deep: 4 },
  deepM: 1.2,
  sizeFt: { length: 77, width: 34 },
  sizeM: { length: 23.5, width: 10.4 },
  cctv: true,
}

/** Futsal court rates per hour (MMK). Mirrors lib/booking.ts priceForHour. */
export const FUTSAL_RATES = {
  weekdayMorning: 20000,
  weekdayAfternoon: 25000,
  weekendHoliday: 30000,
  deposit: 10000,
}

/** Game shop, from MyaThida_Game/supabase/seed.sql. */
export const GAME = {
  screens: 9,
  // Fallback only: /games reads the live split and rates from the game
  // admin (lib/park/game-board.server.ts). Matches the admin on 2026-10-18.
  ps4Screens: [1, 2, 3, 4, 5],
  ps5Screens: [6, 7, 8, 9],
  rates: { ps4: 3000, ps5: 5000, vip: 7000 },
  minimumMinutes: 30,
  blockMinutes: 30,
  graceMinutes: 10,
  snacks: [
    { key: 'coke', price: 1000 },
    { key: 'energyDrink', price: 2000 },
    { key: 'chips', price: 1000 },
    { key: 'noodles', price: 1500 },
    { key: 'chocolate', price: 1200 },
    { key: 'peanuts', price: 800 },
    { key: 'water', price: 500 },
  ],
} as const

/** Billiards, from Billiards_MyaThida/supabase/migrations/0002_seed.sql.
 *  The seed rate is a placeholder the client has not confirmed, so it stays null. */
export const BILLIARDS = {
  tables: 3,
  ratePerHour: null as number | null,
  /** First month the room is open, 'YYYY-MM'. Until then the site shows an
   *  "Opening in …" badge; after it the badge disappears on its own. */
  opensOn: '2026-11',
  menu: {
    drinks: [
      { key: 'water', price: 500 },
      { key: 'greenTea', price: 300 },
      { key: 'coffee', price: 1000 },
      { key: 'coke', price: 1000 },
      { key: 'redBull', price: 1500 },
      { key: 'beer', price: 3000 },
    ],
    food: [
      { key: 'samosa', price: 500 },
      { key: 'chips', price: 1000 },
      { key: 'peanutsRoasted', price: 1500 },
      { key: 'friedNoodles', price: 3000 },
      { key: 'friedRice', price: 3500 },
    ],
  },
} as const

export type MenuItemKey =
  | (typeof GAME.snacks)[number]['key']
  | (typeof BILLIARDS.menu.drinks)[number]['key']
  | (typeof BILLIARDS.menu.food)[number]['key']

/** Year and month (1-12) billiards opens, or null once that month has begun in Myanmar time. */
export function billiardsOpening(now: Date = new Date()): { year: number; month: number } | null {
  const [year, month] = BILLIARDS.opensOn.split('-').map(Number)
  // Myanmar is UTC+6:30; the first of the month starts at 17:30 UTC the day before.
  const opens = Date.UTC(year, month - 1, 1) - 390 * 60_000
  return now.getTime() >= opens ? null : { year, month }
}
