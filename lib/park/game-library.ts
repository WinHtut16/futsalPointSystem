import type { ShelfTitle } from './game-board'

// How the /games library is put together from the staff's list. Pure, so the
// rules are unit-tested (__tests__/park-game-library.test.ts).

export type RowKey = 'new' | 'coop' | 'ps5' | 'ps4' | 'sports' | 'action' | 'online'

export type LibraryRow = { key: RowKey; titles: ShelfTitle[] }

/** A row needs at least this many games, or it reads as a gap. */
export const MIN_ROW = 3
/** More rows than this turns the page into a wall; "All games" covers the rest. */
export const MAX_ROWS = 4
/** Once the list is this long, a row holding most of it says nothing new. */
const BROAD_FROM = 8
const BROAD_SHARE = 0.75
export const FEATURED_MAX = 5

const ROWS: { key: RowKey; test: (g: ShelfTitle) => boolean }[] = [
  { key: 'new', test: (g) => g.isNew },
  { key: 'coop', test: (g) => g.localCoop },
  { key: 'ps5', test: (g) => g.platforms.includes('PS5') },
  { key: 'ps4', test: (g) => g.platforms.includes('PS4') },
  { key: 'sports', test: (g) => g.genre === 'sports' || g.genre === 'racing' },
  { key: 'action', test: (g) => ['action', 'adventure', 'shooter', 'fighting'].includes(g.genre) },
  { key: 'online', test: (g) => g.online },
]

/**
 * Category rows in display order, each in the staff's order. Thin rows are
 * dropped, and so are rows that hold most of a long list (e.g. "On PS5" when
 * nearly everything is PS5): they would only repeat "All games".
 */
export function buildRows(titles: ShelfTitle[]): LibraryRow[] {
  const broad = (count: number) => titles.length >= BROAD_FROM && count > titles.length * BROAD_SHARE
  return ROWS.map(({ key, test }) => ({ key, titles: titles.filter(test) }))
    .filter((r) => r.titles.length >= MIN_ROW && !broad(r.titles.length))
    .slice(0, MAX_ROWS)
}

/**
 * The spotlight: games marked Featured; failing that, Popular then New; failing
 * that, the first few with a cover. Covers matter most here, so covered games
 * go first within each group.
 */
export function pickFeatured(titles: ShelfTitle[]): ShelfTitle[] {
  const covered = (list: ShelfTitle[]) => [...list.filter((g) => g.coverUrl), ...list.filter((g) => !g.coverUrl)]
  const featured = titles.filter((g) => g.featured)
  if (featured.length) return covered(featured).slice(0, FEATURED_MAX)
  const promoted = titles.filter((g) => g.isPopular || g.isNew)
  if (promoted.length) return covered(promoted).slice(0, FEATURED_MAX)
  return covered(titles).slice(0, FEATURED_MAX)
}

export type LibraryFilter = 'all' | 'PS4' | 'PS5' | 'coop'

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

/** Search + filter for "All games": every word of the query must appear in the title. */
export function filterTitles(titles: ShelfTitle[], query: string, filter: LibraryFilter): ShelfTitle[] {
  const words = fold(query).split(' ').filter(Boolean)
  return titles.filter((g) => {
    if (filter === 'PS4' || filter === 'PS5') {
      if (!g.platforms.includes(filter)) return false
    } else if (filter === 'coop' && !g.localCoop) return false
    if (!words.length) return true
    const hay = fold(g.title)
    return words.every((w) => hay.includes(w))
  })
}

/** Description in the visitor's language, falling back to the other one. */
export function descriptionFor(g: ShelfTitle, lang: string): string | null {
  return lang === 'my' ? (g.descriptionMy ?? g.descriptionEn) : (g.descriptionEn ?? g.descriptionMy)
}
