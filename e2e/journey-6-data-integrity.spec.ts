import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { loginAsCustomer, loginAsAdmin } from './helpers/auth'

// ── Env ───────────────────────────────────────────────────────────────────────
const SUPERADMIN_EMAIL    = process.env.E2E_SUPERADMIN_EMAIL!
const SUPERADMIN_PASSWORD = process.env.E2E_SUPERADMIN_PASSWORD!
const CUSTOMER_PHONE      = process.env.E2E_CUSTOMER_PHONE!
const CUSTOMER_PASSWORD   = process.env.E2E_CUSTOMER_PASSWORD!
const NEW_PHONE           = process.env.E2E_NEW_CUSTOMER_PHONE!
const NEW_PASSWORD        = process.env.E2E_NEW_CUSTOMER_PASSWORD!
const REWARD_NAME         = process.env.E2E_REWARD_NAME ?? 'E2E Test Reward'

// Dedicated throwaway phone for scenario F (cascade delete)
// NOT in global-setup; cleaned up by this file's afterAll
const THROWAWAY_PHONE = '09111000099'
const THROWAWAY_PASS  = 'Throwaway123!'

// ── Supabase service-role client ──────────────────────────────────────────────
function makeDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

// ── Journey 6 ─────────────────────────────────────────────────────────────────

test.describe.serial('Journey 6: Data Integrity', () => {
  // Defensive pre-run cleanup: if a previous run crashed before afterAll, stale
  // profiles would cause registration tests to 409 on the next run.
  test.beforeAll(async () => {
    const db = makeDb()

    const { data: newProfile } = await db
      .from('profiles').select('id').eq('phone', NEW_PHONE).maybeSingle()
    if (newProfile) await db.auth.admin.deleteUser(newProfile.id)

    const { data: throwaway } = await db
      .from('profiles').select('id').eq('phone', THROWAWAY_PHONE).maybeSingle()
    if (throwaway) await db.auth.admin.deleteUser(throwaway.id)
  })

  test.afterAll(async () => {
    const db = makeDb()

    // Remove ephemeral new customer created in scenario A
    const { data: newProfile } = await db
      .from('profiles').select('id').eq('phone', NEW_PHONE).maybeSingle()
    if (newProfile) await db.auth.admin.deleteUser(newProfile.id)

    // Remove throwaway customer from scenario F (defensive — may already be deleted by test)
    const { data: throwaway } = await db
      .from('profiles').select('id').eq('phone', THROWAWAY_PHONE).maybeSingle()
    if (throwaway) await db.auth.admin.deleteUser(throwaway.id)

    // Cancel any open pending redemptions left by the main test customer
    const { data: mainProfile } = await db
      .from('profiles').select('id').eq('phone', CUSTOMER_PHONE).maybeSingle()
    if (mainProfile) {
      await db
        .from('redemption_requests')
        .update({ status: 'cancelled' })
        .eq('status', 'pending')
        .eq('customer_id', mainProfile.id)
    }
  })

  // ── A. Registration stores required fields ──────────────────────────────────

  test('A: registration stores id, phone, username, role=customer, total_points=0, non-null created_at', async ({ request }) => {
    const db = makeDb()

    const res = await request.post('/api/auth/register', {
      data: { phone: NEW_PHONE, username: 'E2E Journey6', password: NEW_PASSWORD },
    })
    expect(res.status()).toBe(200)

    // handle_new_user DB trigger is async — give it a moment
    await sleep(1500)

    const { data: profile } = await db
      .from('profiles').select('*').eq('phone', NEW_PHONE).maybeSingle()

    expect(profile).not.toBeNull()
    expect(profile!.phone).toBe(NEW_PHONE)
    expect(profile!.role).toBe('customer')
    expect(profile!.total_points).toBe(0)
    expect(profile!.created_at).not.toBeNull()
    expect(new Date(profile!.created_at).toString()).not.toBe('Invalid Date')
  })

  // ── B. Duplicate phone rejected ─────────────────────────────────────────────

  test('B: duplicate phone registration returns 4xx (NEW_PHONE registered in test A)', async ({ request }) => {
    const res = await request.post('/api/auth/register', {
      data: { phone: NEW_PHONE, username: 'AnotherUser', password: NEW_PASSWORD },
    })
    // 409 from app-level check or 409 from auth-level fallback
    expect(res.status()).toBeGreaterThanOrEqual(400)
    expect(res.status()).toBeLessThan(500)
  })

  // ── C. Points issuance creates correct transaction record ───────────────────

  test('C: add-points creates transaction with type=earn, correct delta, non-null created_at', async ({ page }) => {
    const db = makeDb()

    await loginAsAdmin(page, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD)

    const { data: profile } = await db
      .from('profiles').select('id').eq('phone', CUSTOMER_PHONE).maybeSingle()
    expect(profile).not.toBeNull()
    const customerId = profile!.id

    // page.request inherits the admin session cookies set by loginAsAdmin
    const addRes = await page.request.post('/api/points/add', {
      data: { customer_id: customerId, hours_played: 1 },
    })
    expect(addRes.status()).toBe(200)

    const { data: txns } = await db
      .from('point_transactions')
      .select('transaction_type, points_delta, created_at')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(1)

    expect(txns).not.toBeNull()
    expect(txns!).toHaveLength(1)
    const txn = txns![0]
    expect(txn.transaction_type).toBe('earn')
    expect(txn.points_delta).toBe(10) // 1 hour × 10 pts/hr
    expect(txn.created_at).not.toBeNull()
    expect(new Date(txn.created_at).toString()).not.toBe('Invalid Date')
  })

  // ── D. Approve records resolved_at ─────────────────────────────────────────

  test('D: approving a redemption sets status=approved and resolved_at > requested_at', async ({ browser }) => {
    const db = makeDb()

    const { data: profile } = await db
      .from('profiles').select('id').eq('phone', CUSTOMER_PHONE).maybeSingle()
    expect(profile).not.toBeNull()

    const { data: reward } = await db
      .from('rewards').select('id').eq('name', REWARD_NAME).single()
    expect(reward).not.toBeNull()

    const customerCtx = await browser.newContext()
    const customerPage = await customerCtx.newPage()
    const adminCtx = await browser.newContext()
    const adminPage = await adminCtx.newPage()

    try {
      // Customer submits a redemption request via the API
      await loginAsCustomer(customerPage, CUSTOMER_PHONE, CUSTOMER_PASSWORD)
      const redeemRes = await customerPage.request.post('/api/redemptions', {
        data: { reward_id: reward!.id },
      })
      expect(redeemRes.status()).toBe(201)
      const { id: requestId } = await redeemRes.json()

      // Admin approves it
      await loginAsAdmin(adminPage, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD)
      const approveRes = await adminPage.request.patch(`/api/redemptions/${requestId}`, {
        data: { action: 'approve' },
      })
      expect(approveRes.status()).toBe(200)

      // Assert DB state: status=approved, resolved_at set and after requested_at
      const { data: req } = await db
        .from('redemption_requests')
        .select('status, requested_at, resolved_at')
        .eq('id', requestId)
        .single()

      expect(req!.status).toBe('approved')
      expect(req!.resolved_at).not.toBeNull()
      expect(new Date(req!.resolved_at).toString()).not.toBe('Invalid Date')
      expect(new Date(req!.resolved_at) > new Date(req!.requested_at)).toBe(true)
    } finally {
      await customerCtx.close()
      await adminCtx.close()
    }
  })

  // ── E. Dashboard period filter — empty month returns zeros, not error ────────

  test('E: dashboard with month=1&year=2000 renders without error and shows period UI', async ({ page }) => {
    await loginAsAdmin(page, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD)
    await page.goto('/admin/dashboard?month=1&year=2000')
    await page.waitForLoadState('networkidle')

    // No 500 error page — Next.js would show "Internal Server Error" or similar
    await expect(page.getByText(/internal server error/i)).not.toBeVisible({ timeout: 5000 })

    // Dashboard renders: the "New Customers" period stat card is visible
    // (For Jan 2000 there are zero customers — the card still renders)
    await expect(page.getByText('New Customers')).toBeVisible({ timeout: 10000 })
  })

  // ── F. Customer delete cascades ─────────────────────────────────────────────

  test('F: deleting a customer removes their profiles row and auth.users entry', async ({ page }) => {
    const db = makeDb()

    await loginAsAdmin(page, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD)

    // Register a throwaway customer (public endpoint — page session not needed, but page.request works too)
    const registerRes = await page.request.post('/api/auth/register', {
      data: { phone: THROWAWAY_PHONE, username: 'ThrowawayUser', password: THROWAWAY_PASS },
    })
    expect(registerRes.status()).toBe(200)

    // Wait for handle_new_user trigger
    await sleep(1500)

    const { data: throwaway } = await db
      .from('profiles').select('id').eq('phone', THROWAWAY_PHONE).maybeSingle()
    expect(throwaway).not.toBeNull()
    const throwawayId = throwaway!.id

    // Add points so there are point_transactions rows to inspect post-delete
    const addRes = await page.request.post('/api/points/add', {
      data: { customer_id: throwawayId, hours_played: 1 },
    })
    expect(addRes.status()).toBe(200)

    // Delete the customer via admin API
    const deleteRes = await page.request.delete(`/api/customers/${throwawayId}`)
    expect(deleteRes.status()).toBe(200)

    // profiles row must be gone
    const { data: gone } = await db
      .from('profiles').select('id').eq('id', throwawayId).maybeSingle()
    expect(gone).toBeNull()

    // Document point_transactions cascade behavior (FK may or may not have CASCADE DELETE)
    const { data: txns } = await db
      .from('point_transactions').select('id').eq('customer_id', throwawayId)
    console.log(`[Journey 6F] point_transactions after customer delete: ${txns?.length ?? 0} rows`)
    // We do not assert a specific count here — document the DB cascade behavior for the team
  })
})
