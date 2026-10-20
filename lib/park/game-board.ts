// The game room as the counter sees it right now: which TVs are free, in use,
// reserved or switched off, and the current hourly rates. Read from the game
// shop's own admin tables (game.stations, game.pricing) by
// lib/park/game-board.server.ts; shared types and helpers live here so the
// client can use them too.

export type StationTier = 'PS4' | 'PS5' | 'VIP'
export type StationStatus = 'free' | 'busy' | 'reserved' | 'maintenance'

export type BoardStation = {
  /** Stable seat key: `tv{n}` for numbered screens, `vip` for the VIP room. */
  id: string
  /** Screen number, or null for the VIP room. */
  n: number | null
  tier: StationTier
  status: StationStatus
}

export type BoardRates = {
  ps4: number
  ps5: number
  vip: number
  minMinutes: number
  stepMinutes: number
  graceMinutes: number
}

export type GameBoard = {
  stations: BoardStation[]
  /** Null when the pricing table could not be read; callers fall back. */
  rates: BoardRates | null
  /** ISO time the board was read from the database. */
  at: string
}

/** A board older than this is not shown as live; the plan goes static. */
export const BOARD_STALE_MS = 5 * 60_000

/** Browser poll interval while the page is visible. */
export const BOARD_POLL_MS = 30_000

/**
 * Admin rows -> board. Maintenance (the TV is switched off) outranks whatever
 * session state the row still carries; `occupied` is set and cleared by
 * sessions, `reserved` by staff.
 */
export function toBoardStation(row: { name: string; tier: string; status: string; state: string }): BoardStation | null {
  const tier = row.tier.toUpperCase()
  if (tier !== 'PS4' && tier !== 'PS5' && tier !== 'VIP') return null
  const num = /(\d+)/.exec(row.name)
  const n = tier === 'VIP' ? null : num ? Number(num[1]) : null
  if (tier !== 'VIP' && n === null) return null
  const status: StationStatus =
    row.status === 'maintenance'
      ? 'maintenance'
      : row.state === 'occupied'
        ? 'busy'
        : row.state === 'reserved'
          ? 'reserved'
          : 'free'
  return { id: n === null ? 'vip' : `tv${n}`, n, tier, status }
}

/** A game on the shelf (game.titles, visible rows only), for the public page. */
export type ShelfGenre =
  | 'action' | 'adventure' | 'fighting' | 'racing' | 'sports' | 'shooter'
  | 'horror' | 'party' | 'family' | 'rpg' | 'other'

export type ShelfTitle = {
  id: string
  title: string
  platforms: ('PS4' | 'PS5')[]
  genre: ShelfGenre
  maxPlayers: number
  coverUrl: string | null
  isNew: boolean
  isPopular: boolean
  descriptionEn: string | null
  descriptionMy: string | null
  /** Two or more people can play together on one screen. */
  localCoop: boolean
  online: boolean
  /** Leads the Featured spotlight. */
  featured: boolean
}

export const SHELF_GENRES: readonly ShelfGenre[] = [
  'action', 'adventure', 'fighting', 'racing', 'sports', 'shooter',
  'horror', 'party', 'family', 'rpg', 'other',
]
