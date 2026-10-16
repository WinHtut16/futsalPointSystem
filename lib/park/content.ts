// Park showcase facts. Language-neutral data only (numbers, hours, links);
// every visible sentence lives in lib/i18n/namespaces/park.ts.
//
// `null` means the client has not supplied it yet (see
// docs/park/client-content-checklist.md). Components must hide a row whose
// value is null rather than print a placeholder.

export type VenueKey = 'pool' | 'restaurant' | 'futsal' | 'games' | 'billiards'

/** Opening hours as 24h integers in Myanmar time, e.g. { open: 6, close: 22 }. */
export type Hours = { open: number; close: number }

export const PARK = {
  address: null as string | null,
  addressMy: null as string | null,
  mapsUrl: null as string | null,
  phone: null as string | null,
  facebookUrl: null as string | null,
  // Same Viber deep link the futsal site uses (CLAUDE.md: never a web URL).
  viberUrl: 'viber://chat?number=%2B959797272000',
}

export const HOURS: Record<VenueKey, Hours | null> = {
  pool: null,
  restaurant: null,
  // lib/booking.ts dayHours: 16 slots, 06:00 to 21:00, last slot ends 22:00.
  futsal: { open: 6, close: 22 },
  games: null,
  billiards: null,
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
  ps4Screens: [1, 2, 3, 4, 5, 6, 7],
  ps5Screens: [8, 9],
  rates: { ps4: 3000, ps5: 5000, vip: 7000 },
  minimumMinutes: 30,
  blockMinutes: 10,
  graceMinutes: 5,
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

/** Billiards, from Billiards_MyaThida seed. Rate is unconfirmed by the client. */
export const BILLIARDS = {
  tables: 3,
  ratePerHour: null as number | null,
} as const

export function formatMMK(n: number): string {
  return n.toLocaleString('en-US')
}
