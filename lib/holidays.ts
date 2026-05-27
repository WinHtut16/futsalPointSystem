// Myanmar public holidays — ISO date → names (EN + MY).
// Update this array annually with the new Myanmar public holiday gazette.

export type Holiday = { date: string; nameEn: string; nameMy: string }

export const MYANMAR_HOLIDAYS: Holiday[] = [
  // 2026 ---------------------------------------------------------------
  { date: '2026-01-01', nameEn: "New Year's Day",             nameMy: 'နှစ်သစ်ကူးနေ့' },
  { date: '2026-01-04', nameEn: 'Independence Day',            nameMy: 'လွတ်လပ်ရေးနေ့' },
  { date: '2026-02-12', nameEn: 'Union Day',                   nameMy: 'ပြည်ထောင်စုနေ့' },
  { date: '2026-03-02', nameEn: "Peasants' Day",               nameMy: 'တောင်သူလယ်သမားနေ့' },
  { date: '2026-03-02', nameEn: 'Full Moon of Tabaung',        nameMy: 'တပေါင်းပြည့်နေ့' },
  { date: '2026-03-27', nameEn: 'Armed Forces Day',            nameMy: 'တပ်မတော်နေ့' },
  { date: '2026-04-13', nameEn: 'Thingyan Day 1',              nameMy: 'သင်္ကြန် (ပထမနေ့)' },
  { date: '2026-04-14', nameEn: 'Thingyan Day 2',              nameMy: 'သင်္ကြန် (ဒုတိယနေ့)' },
  { date: '2026-04-15', nameEn: 'Thingyan Day 3',              nameMy: 'သင်္ကြန် (တတိယနေ့)' },
  { date: '2026-04-16', nameEn: 'Thingyan Day 4',              nameMy: 'သင်္ကြန် (စတုတ္ထနေ့)' },
  { date: '2026-04-17', nameEn: 'Myanmar New Year',            nameMy: 'နှစ်သစ်ကူးနေ့ (မြန်မာ)' },
  { date: '2026-04-30', nameEn: 'Full Moon Day of Kasong',     nameMy: 'ကဆုန်ပြည့်နေ့' },
  { date: '2026-05-01', nameEn: 'Labour Day',                  nameMy: 'အလုပ်သမားနေ့' },
  { date: '2026-07-19', nameEn: "Martyrs' Day",                nameMy: 'အာဇာနည်နေ့' },
  { date: '2026-07-29', nameEn: 'Full Moon Day of Waso',       nameMy: 'ဝါဆိုပြည့်နေ့' },
  { date: '2026-10-25', nameEn: 'Thadingyut Day 1',            nameMy: 'သီတင်းကျွတ်ပြည့်နေ့ (ပထမနေ့)' },
  { date: '2026-10-26', nameEn: 'Thadingyut Day 2',            nameMy: 'သီတင်းကျွတ်ပြည့်နေ့ (ဒုတိယနေ့)' },
  { date: '2026-10-27', nameEn: 'Thadingyut Day 3',            nameMy: 'သီတင်းကျွတ်ပြည့်နေ့ (တတိယနေ့)' },
  { date: '2026-11-23', nameEn: 'Tazaungmone Day 1',           nameMy: 'တန်ဆောင်မုန်းပြည့်နေ့ (ပထမနေ့)' },
  { date: '2026-11-24', nameEn: 'Tazaungmone Day 2',           nameMy: 'တန်ဆောင်မုန်းပြည့်နေ့ (ဒုတိယနေ့)' },
  { date: '2026-12-04', nameEn: 'National Day',                nameMy: 'အမျိုးသားနေ့' },
  { date: '2026-12-25', nameEn: 'Christmas',                   nameMy: 'ခရစ္စမတ်နေ့' },
]

// Build lookup: 'YYYY-MM-DD' -> combined EN + MY names (handles duplicate dates).
const _map = new Map<string, { nameEn: string; nameMy: string }>()
for (const h of MYANMAR_HOLIDAYS) {
  const existing = _map.get(h.date)
  if (existing) {
    existing.nameEn += ' / ' + h.nameEn
    existing.nameMy += ' / ' + h.nameMy
  } else {
    _map.set(h.date, { nameEn: h.nameEn, nameMy: h.nameMy })
  }
}

/** Returns true if the ISO date (YYYY-MM-DD) is a Myanmar public holiday. */
export function isHoliday(isoDate: string): boolean {
  return _map.has(isoDate)
}

/**
 * Returns the holiday name for an ISO date, or null if not a holiday.
 * Defaults to English; pass 'my' for Myanmar.
 */
export function getHolidayName(isoDate: string, lang: 'en' | 'my' = 'en'): string | null {
  const h = _map.get(isoDate)
  if (!h) return null
  return lang === 'my' ? h.nameMy : h.nameEn
}

/**
 * Returns the pricing tier for the given ISO date and hour.
 * Public holidays are charged at the weekend rate (30,000 MMK) all day.
 * Mirrors lib/booking.ts tierForHour but usable without circular imports.
 */
export function getSlotTier(isoDate: string, hour: number): 'morning' | 'evening' | 'weekend' {
  if (isHoliday(isoDate)) return 'weekend'
  // Weekend (Sat/Sun) — use UTC date to avoid TZ shift.
  const [y, m, d] = isoDate.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  if (dow === 0 || dow === 6) return 'weekend'
  // Thingyan Apr 13–16 (all years not yet in config)
  if (m === 4 && d >= 13 && d <= 16) return 'weekend'
  return hour < 14 ? 'morning' : 'evening'
}
