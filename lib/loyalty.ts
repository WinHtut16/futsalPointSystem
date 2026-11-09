import type { AppName } from './apps'
import type { RedemptionRequest } from '@/types'

/**
 * Loyalty for the game shop and billiards, managed from this hub.
 *
 * PURE: constants and helpers only, safe for client components. The access
 * check lives in ./loyalty.server.
 *
 * Futsal is deliberately not in this list. Its loyalty screens are the
 * original (admin) section and stay exactly as they were; these two
 * businesses get their own area under /admin/loyalty/<app>, guarded by THAT
 * business's grant (the (admin) section requires a futsal grant, which a
 * billiards-only manager does not hold).
 */
export const LOYALTY_APPS = ['game', 'billiards'] as const
export type LoyaltyApp = (typeof LOYALTY_APPS)[number]

export function isLoyaltyApp(value: string): value is LoyaltyApp {
  return (LOYALTY_APPS as readonly string[]).includes(value)
}

/** Admin pages for one business. */
export function loyaltyPath(app: LoyaltyApp, sub = ''): string {
  return `/admin/loyalty/${app}${sub}`
}

/** API routes for one business. Every handler there is pinned to that app. */
export function loyaltyApi(app: LoyaltyApp, sub = ''): string {
  return `/api/loyalty/${app}${sub}`
}

/**
 * Redemption rows with the customer's balance AT THIS BUSINESS.
 *
 * profiles.total_points is the futsal balance only, so the wallets are
 * embedded and the right one is folded into customer.total_points by
 * withBusinessBalance below - the card component keeps reading the field it
 * always read.
 */
export const BUSINESS_REDEMPTION_SELECT =
  '*, reward:rewards(name, points_cost), customer:profiles!customer_id(username, phone, total_points, wallets:point_wallets(app, balance))'

type RowWithWallets = RedemptionRequest & {
  customer?: (RedemptionRequest['customer'] & { wallets?: { app: string; balance: number }[] }) | null
}

export function withBusinessBalance(rows: unknown[] | null, app: AppName): RedemptionRequest[] {
  return ((rows ?? []) as RowWithWallets[]).map((row) => {
    if (!row.customer) return row
    const { wallets, ...customer } = row.customer
    const balance = wallets?.find((w) => w.app === app)?.balance ?? 0
    return { ...row, customer: { ...customer, total_points: balance } }
  })
}
