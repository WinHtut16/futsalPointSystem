import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers/auth'

// ── Env ───────────────────────────────────────────────────────────────────────
const SUPERADMIN_EMAIL    = process.env.E2E_SUPERADMIN_EMAIL!
const SUPERADMIN_PASSWORD = process.env.E2E_SUPERADMIN_PASSWORD!
const STAFF_USERNAME      = process.env.E2E_STAFF_USERNAME ?? 'e2eteststaff'
const STAFF_PASSWORD      = process.env.E2E_STAFF_PASSWORD ?? 'TestStaff123'
const J3_REWARD_NAME      = process.env.E2E_J3_REWARD_NAME ?? 'E2E Journey3 Reward'
const J3_REWARD_POINTS    = process.env.E2E_J3_REWARD_POINTS ?? '50'

// ── Journey 3 ─────────────────────────────────────────────────────────────────
//
// Steps run in file order (workers: 1, sequential execution):
//   1. Create staff admin → verify in list
//   2. Create reward → verify in list
//   3. Delete the reward → verify gone
//   4. Delete the staff admin → verify gone
//
// global-setup removes stale data from previous failed runs before each suite.

test.describe('Journey 3: Superadmin manages staff and rewards', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD)
  })

  // ── Staff admin ────────────────────────────────────────────────────────────

  test('creates a new staff admin account', async ({ page }) => {
    await page.goto('/admin/staff/new')

    await expect(page.getByRole('heading', { name: 'New Admin Account' })).toBeVisible()

    await page.fill('#username', STAFF_USERNAME)
    await page.fill('#password', STAFF_PASSWORD)
    await page.getByRole('button', { name: 'Create Admin Account' }).click()

    // CreateAdminForm redirects to the staff list on success
    await page.waitForURL('**/admin/staff')

    // New staff admin appears in the list
    await expect(page.getByText(STAFF_USERNAME)).toBeVisible()
  })

  // ── Reward ─────────────────────────────────────────────────────────────────

  test('creates a new reward', async ({ page }) => {
    await page.goto('/admin/rewards/new')

    await expect(page.getByRole('heading', { name: 'New Reward' })).toBeVisible()

    await page.fill('#name', J3_REWARD_NAME)
    await page.fill('#points_cost', J3_REWARD_POINTS)
    await page.getByRole('button', { name: 'Create Reward' }).click()

    // RewardForm redirects to the rewards list on success
    await page.waitForURL('**/admin/rewards')

    // New reward appears in the list with its points cost
    await expect(page.getByText(J3_REWARD_NAME)).toBeVisible()
    await expect(page.getByText(`${J3_REWARD_POINTS} pts`)).toBeVisible()
  })

  test('deletes the created reward', async ({ page }) => {
    await page.goto('/admin/rewards')

    // Scope to the row for the Journey 3 reward only
    const rewardRow = page.locator('.flex.items-start', { hasText: J3_REWARD_NAME })
    await expect(rewardRow).toBeVisible()

    // Accept the window.confirm dialog before clicking Delete
    page.once('dialog', (dialog) => dialog.accept())
    await rewardRow.getByRole('button', { name: 'Delete' }).click()

    // router.refresh() re-renders the list; reward should be gone
    await expect(page.getByText(J3_REWARD_NAME)).not.toBeVisible()
  })

  // ── Staff admin (delete) ───────────────────────────────────────────────────

  test('navigates to the staff detail page', async ({ page }) => {
    await page.goto('/admin/staff')

    // Staff list shows the username as a link row
    await expect(page.getByText(STAFF_USERNAME)).toBeVisible()
    await page.getByText(STAFF_USERNAME).click()

    await page.waitForURL(/\/admin\/staff\/[0-9a-f-]+/)
    await expect(page.getByText(STAFF_USERNAME, { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Danger Zone' })).toBeVisible()
  })

  test('deletes the created staff admin account', async ({ page }) => {
    await page.goto('/admin/staff')

    await page.getByText(STAFF_USERNAME).click()
    await page.waitForURL(/\/admin\/staff\/[0-9a-f-]+/)

    // Accept the window.confirm dialog before clicking Delete
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Delete Admin Account' }).click()

    // DeleteStaffButton redirects back to /admin/staff on success
    await page.waitForURL('**/admin/staff')

    // Staff admin no longer appears in the list
    await expect(page.getByText(STAFF_USERNAME)).not.toBeVisible()
  })
})
