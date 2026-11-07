import type { SupabaseClient } from '@supabase/supabase-js'
import type { AppName } from './apps'

// Change this value when client decides the rate
export const POINTS_PER_HOUR = 10

/**
 * This app's own business. Every futsal screen filters points history,
 * rewards and redemption requests by it, so game and billiards rows (same
 * tables, separate wallets) never show up here.
 */
export const FUTSAL: AppName = 'futsal'

export function calculatePoints(hoursPlayed: number): number {
  return Math.round(hoursPlayed * POINTS_PER_HOUR)
}

/**
 * A customer's balance at one business, from point_wallets.
 *
 * A wallet row is created on the first points movement, so a missing row is
 * a balance of 0 - except futsal, where a customer who registered after the
 * wallet backfill falls back to profiles.total_points (the futsal mirror,
 * always written in the same transaction as the wallet).
 */
export async function getWalletBalance(
  supabase: SupabaseClient,
  userId: string,
  app: AppName
): Promise<number> {
  const { data: wallet } = await supabase
    .from('point_wallets')
    .select('balance')
    .eq('user_id', userId)
    .eq('app', app)
    .maybeSingle()
  if (wallet) return wallet.balance as number
  if (app !== FUTSAL) return 0

  const { data: profile } = await supabase
    .from('profiles')
    .select('total_points')
    .eq('id', userId)
    .maybeSingle()
  return (profile?.total_points as number | undefined) ?? 0
}

/**
 * The businesses a customer can switch between on /account, in display
 * order. One account and phone number everywhere; a separate balance and
 * rewards list per business.
 */
export const CUSTOMER_BUSINESSES: readonly AppName[] = ['futsal', 'game', 'billiards']

/** ?biz= / ?app= value to a business, defaulting to futsal for anything unknown. */
export function parseBusiness(value: string | null | undefined): AppName {
  return (CUSTOMER_BUSINESSES as readonly string[]).includes(value ?? '') ? (value as AppName) : FUTSAL
}
