import 'server-only'
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import {
  SHELF_GENRES,
  toBoardStation,
  type BoardRates,
  type BoardStation,
  type GameBoard,
  type ShelfGenre,
  type ShelfTitle,
} from './game-board'

// Reads the live game room for the public /games page. Service role, because
// the game tables are staff-only under RLS; only the columns below ever leave
// this function (no session, customer or takings data). Not cached: two tiny
// reads per page view or poll. (A Data Cache entry here was served stale after
// a quiet spell, often older than BOARD_STALE_MS, so the page hid the statuses
// until its next poll.)
async function readGameBoard(): Promise<GameBoard | null> {
  const game = createServiceClient().schema('game')
  const [stationsRes, pricingRes] = await Promise.all([
    game.from('stations').select('name, tier, status, state, sort_order').order('sort_order'),
    game.from('pricing').select('tier, rate_per_hour, min_minutes, increment_minutes, grace_minutes'),
  ])
  if (stationsRes.error || !stationsRes.data) {
    console.error('[park] game board: stations read failed', stationsRes.error?.message)
    return null
  }

  const stations = stationsRes.data
    .map(toBoardStation)
    .filter((s): s is BoardStation => s !== null)

  let rates: BoardRates | null = null
  if (!pricingRes.error && pricingRes.data) {
    const byTier = new Map(pricingRes.data.map((p) => [String(p.tier).toUpperCase(), p]))
    const ps4 = byTier.get('PS4')
    const ps5 = byTier.get('PS5')
    const vip = byTier.get('VIP')
    if (ps4 && ps5 && vip) {
      rates = {
        ps4: Number(ps4.rate_per_hour),
        ps5: Number(ps5.rate_per_hour),
        vip: Number(vip.rate_per_hour),
        // The rules are per tier in the admin; the page states one set, so it
        // uses the PS4 row (all tiers share them today).
        minMinutes: Number(ps4.min_minutes),
        stepMinutes: Number(ps4.increment_minutes ?? ps4.min_minutes),
        graceMinutes: Number(ps4.grace_minutes ?? 0),
      }
    }
  }

  return { stations, rates, at: new Date().toISOString() }
}

export async function getGameBoard(): Promise<GameBoard | null> {
  try {
    return await readGameBoard()
  } catch (e) {
    console.error('[park] game board: read threw', e instanceof Error ? e.message : e)
    return null
  }
}

// Games on the shelf, managed on the game admin's Games screen. Visible rows
// only, in the staff's order. Cached for a minute and tagged, so a save on the
// Games screen expires it at once (app/api/park/revalidate-games). A missing
// table (migration not run yet) or any error just means an empty shelf.
const SHELF_BASE = 'id, title, platforms, genre, max_players, cover_url, is_new, is_popular'
const SHELF_DETAILS = ', description_en, description_my, local_coop, online, featured'

type ShelfRow = {
  id: string
  title: string
  platforms: string[]
  genre: string
  max_players: number
  cover_url: string | null
  is_new: boolean
  is_popular: boolean
  description_en?: string | null
  description_my?: string | null
  local_coop?: boolean
  online?: boolean
  featured?: boolean
}

async function readShelf(): Promise<ShelfTitle[]> {
  const read = (cols: string) =>
    createServiceClient().schema('game').from('titles').select(cols).eq('visible', true).order('sort_order').order('title')
  let res = await read(SHELF_BASE + SHELF_DETAILS)
  // 42703: game-titles-details-migration.sql not run yet; show what we have.
  if (res.error?.code === '42703') res = await read(SHELF_BASE)
  const { error } = res
  const data = res.data as unknown as ShelfRow[] | null
  if (error || !data) {
    if (error && error.code !== '42P01' && error.code !== 'PGRST205') {
      console.error('[park] game shelf: read failed', error.code, error.message)
    }
    return []
  }
  return data.map((r) => ({
    id: String(r.id),
    title: String(r.title),
    platforms: (r.platforms as string[]).filter((p): p is 'PS4' | 'PS5' => p === 'PS4' || p === 'PS5'),
    genre: (SHELF_GENRES as readonly string[]).includes(r.genre) ? (r.genre as ShelfGenre) : 'other',
    maxPlayers: Number(r.max_players) || 1,
    // Only Cloudinary covers: the park CSP and next/image allow no other host.
    coverUrl: typeof r.cover_url === 'string' && r.cover_url.startsWith('https://res.cloudinary.com/') ? r.cover_url : null,
    isNew: Boolean(r.is_new),
    isPopular: Boolean(r.is_popular),
    descriptionEn: r.description_en?.trim() || null,
    descriptionMy: r.description_my?.trim() || null,
    localCoop: Boolean(r.local_coop),
    online: Boolean(r.online),
    featured: Boolean(r.featured),
  }))
}

export const getGameShelf = unstable_cache(
  async () => {
    try {
      return await readShelf()
    } catch (e) {
      console.error('[park] game shelf: read threw', e instanceof Error ? e.message : e)
      return []
    }
  },
  ['park-game-shelf'],
  { revalidate: 60, tags: ['park-game-shelf'] },
)
