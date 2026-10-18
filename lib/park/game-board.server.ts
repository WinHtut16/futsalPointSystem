import 'server-only'
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { toBoardStation, type BoardRates, type BoardStation, type GameBoard } from './game-board'

// Reads the live game room for the public /games page. Service role, because
// the game tables are staff-only under RLS; only the columns below ever leave
// this function (no session, customer or takings data). Cached for 15 s so a
// busy page costs the database at most four small reads a minute.
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

export const getGameBoard = unstable_cache(
  async () => {
    try {
      return await readGameBoard()
    } catch (e) {
      console.error('[park] game board: read threw', e instanceof Error ? e.message : e)
      return null
    }
  },
  ['park-game-board'],
  { revalidate: 15 },
)
