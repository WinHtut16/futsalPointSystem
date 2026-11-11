import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { getActiveRewards } from '@/lib/cached-queries'
import { getWalletBalance } from '@/lib/points'
import { buildTxnFeedItem, type FeedTxnRow } from '@/lib/account-feed'
import { SESSIONS_PAGE, VENUE_PORTAL, parseVenueSessions, type Venue } from '@/lib/venue-account'
import VenueAccount, { type VenueTab } from './VenueAccount'

const FEED_LIMIT = 20
const TABS: readonly VenueTab[] = ['rewards', 'history', 'sessions']

/**
 * Server half of /games/account and /billiards/account: everything the
 * customer sees there, read for that one business only.
 */
export default async function VenueAccountPage({ venue, tab }: { venue: Venue; tab?: string }) {
  const portal = VENUE_PORTAL[venue]
  const profile = await getCurrentUser()
  if (!profile) redirect(`/login?next=${encodeURIComponent(portal)}`)
  // Staff accounts have no customer wallet; middleware sends them on already.
  if (profile.role !== 'customer') redirect('/admin')

  const initialTab: VenueTab = (TABS as readonly string[]).includes(tab ?? '') ? (tab as VenueTab) : 'rewards'
  const supabase = await createClient()

  const [statsRes, txnsRes, sessionsRes, rewards, pendingRes, balance] = await Promise.all([
    supabase
      .from('point_transactions')
      .select('points_delta, transaction_type')
      .eq('app', venue)
      .eq('customer_id', profile.id),
    supabase
      .from('point_transactions')
      .select('id, created_at, points_delta, transaction_type, hours_played, note, reward:rewards(name)')
      .eq('app', venue)
      .eq('customer_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(FEED_LIMIT + 1),
    supabase.rpc('my_venue_sessions', { p_app: venue, p_before: null, p_limit: SESSIONS_PAGE + 1 }),
    getActiveRewards(venue),
    supabase
      .from('redemption_requests')
      .select('id, reward_id')
      .eq('app', venue)
      .eq('customer_id', profile.id)
      .eq('status', 'pending'),
    getWalletBalance(supabase, profile.id, venue),
  ])

  let earned = 0
  let redeemed = 0
  for (const tx of statsRes.data ?? []) {
    if (tx.transaction_type === 'earn') earned += tx.points_delta
    else if (tx.transaction_type === 'redeem') redeemed += -tx.points_delta
  }

  const initialPendingMap: Record<string, string> = {}
  pendingRes.data?.forEach((r) => {
    initialPendingMap[r.reward_id] = r.id
  })

  const txns = (txnsRes.data ?? []) as unknown as FeedTxnRow[]
  // Before the loyalty migration is run the function is missing: show an
  // empty list rather than failing the whole page.
  const sessions = sessionsRes.error ? [] : parseVenueSessions(sessionsRes.data)

  return (
    <VenueAccount
      venue={venue}
      name={profile.username ?? 'Member'}
      userId={profile.id}
      initialPoints={balance}
      earned={earned}
      redeemed={redeemed}
      rewards={rewards}
      initialPendingMap={initialPendingMap}
      initialHistory={{ items: txns.slice(0, FEED_LIMIT).map(buildTxnFeedItem), hasMore: txns.length > FEED_LIMIT }}
      initialSessions={{ items: sessions.slice(0, SESSIONS_PAGE), hasMore: sessions.length > SESSIONS_PAGE }}
      initialTab={initialTab}
    />
  )
}
