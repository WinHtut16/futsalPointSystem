import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { loginAsCustomer, loginAsAdmin } from './helpers/auth'

// ── Env ───────────────────────────────────────────────────────────────────────
const CUSTOMER_PHONE      = process.env.E2E_CUSTOMER_PHONE!
const CUSTOMER_PASSWORD   = process.env.E2E_CUSTOMER_PASSWORD!
const SUPERADMIN_EMAIL    = process.env.E2E_SUPERADMIN_EMAIL!
const SUPERADMIN_PASSWORD = process.env.E2E_SUPERADMIN_PASSWORD!
const REWARD_NAME         = process.env.E2E_REWARD_NAME ?? 'E2E Test Reward'

const EXPENSIVE_REWARD_NAME   = 'E2E Expensive Reward'
const EXPENSIVE_REWARD_POINTS = 99999
const EXPENSIVE_REWARD_UUID   = '00000000-e2e2-4000-a000-000000000002'

// ── Journey 5 ─────────────────────────────────────────────────────────────────
//
// Steps run in file order (workers: 1, sequential execution):
//   1. Customer cannot request a reward when balance is insufficient
//   2. Admin can reject a pending redemption and customer points are unchanged

test.describe('Journey 5: Negative paths', () => {
  test.beforeAll(async () => {
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { error } = await db
      .from('rewards')
      .upsert(
        { id: EXPENSIVE_REWARD_UUID, name: EXPENSIVE_REWARD_NAME, points_cost: EXPENSIVE_REWARD_POINTS, is_active: true, is_deleted: false },
        { onConflict: 'id' }
      )
    if (error) {
      throw new Error(`[Journey 5 setup] Failed to upsert expensive reward: ${error.message}`)
    }

    // Purge the rewards cache so the customer rewards page sees the new reward
    const baseUrl = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
    await fetch(`${baseUrl}/api/test/revalidate-rewards`, { method: 'POST' })
  })

  test.afterAll(async () => {
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    await db.from('rewards').delete().eq('id', EXPENSIVE_REWARD_UUID)
    await db.from('redemption_requests').update({ status: 'cancelled' }).eq('status', 'pending')
  })

  // ── Test 1 ─────────────────────────────────────────────────────────────────

  test('customer cannot request a reward when balance is insufficient', async ({ page }) => {
    await loginAsCustomer(page, CUSTOMER_PHONE, CUSTOMER_PASSWORD)
    await page.goto('/rewards')

    const expensiveCard = page.locator('.rounded-2xl.shadow-sm', { hasText: EXPENSIVE_REWARD_NAME })
    await expect(expensiveCard).toBeVisible()
    // When balance is insufficient the button shows "Not enough pts" and is disabled
    await expect(expensiveCard.getByRole('button', { name: 'Not enough pts' })).toBeDisabled()
  })

  // ── Test 2 ─────────────────────────────────────────────────────────────────

  test('admin can reject a pending redemption and customer points are unchanged', async ({ browser }) => {
    // ── Setup: Create contexts before try block ────────────────────────────────
    const customerCtx = await browser.newContext()
    const customerPage = await customerCtx.newPage()
    const adminCtx = await browser.newContext()
    const adminPage = await adminCtx.newPage()

    try {
      // ── Step 1: customer creates a pending request ─────────────────────────────
      await loginAsCustomer(customerPage, CUSTOMER_PHONE, CUSTOMER_PASSWORD)

      // Get the current points balance (text from the .text-6xl element)
      await customerPage.goto('/dashboard')
      const pointsText = await customerPage.locator('.text-6xl').textContent()
      const initialPoints = parseInt(pointsText?.replace(/,/g, '') ?? '0', 10)

      // Go to rewards and submit a redemption request for REWARD_NAME
      await customerPage.goto('/rewards')
      const rewardCard = customerPage.locator('.rounded-2xl.shadow-sm', { hasText: REWARD_NAME })
      await rewardCard.getByRole('button', { name: 'Request' }).click()
      await customerPage.getByRole('button', { name: 'Send Request' }).click()
      // Wait for the card to show pending state
      await expect(rewardCard.getByText('Pending...')).toBeVisible()

      // ── Step 2: admin rejects the request ─────────────────────────────────────
      await loginAsAdmin(adminPage, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD)
      await adminPage.goto('/admin/redemptions')
      // Reload to bypass Next.js router cache and get a fresh server render
      await adminPage.reload()

      // Click the first Reject button (the customer's pending request should be there)
      const rejectBtn = adminPage.getByRole('button', { name: /reject/i }).first()
      await expect(rejectBtn).toBeVisible({ timeout: 15000 })
      await rejectBtn.click()

      // After rejection the request is removed from the pending list by the component;
      // wait for the "no pending requests" empty state to appear
      await expect(adminPage.getByText('No pending redemption requests.')).toBeVisible({ timeout: 15000 })

      // ── Step 3: verify customer points unchanged ───────────────────────────────
      await customerPage.goto('/dashboard')
      await expect(customerPage.locator('.text-6xl')).toHaveText(initialPoints.toLocaleString('en'))
    } finally {
      // ── Cleanup ────────────────────────────────────────────────────────────────
      await customerCtx.close()
      await adminCtx.close()
    }
  })
})
