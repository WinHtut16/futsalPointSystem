import { test, expect } from '@playwright/test'
import { loginAsCustomer } from './helpers/auth'

// ── Env ───────────────────────────────────────────────────────────────────────
const CUSTOMER_PHONE    = process.env.E2E_CUSTOMER_PHONE!
const CUSTOMER_PASSWORD = process.env.E2E_CUSTOMER_PASSWORD!
const NEW_PHONE         = process.env.E2E_NEW_CUSTOMER_PHONE!
const NEW_PASSWORD      = process.env.E2E_NEW_CUSTOMER_PASSWORD!
const REWARD_NAME       = process.env.E2E_REWARD_NAME ?? 'E2E Test Reward'
const SEED_POINTS       = parseInt(process.env.E2E_CUSTOMER_POINTS ?? '500', 10)

// ── Journey 1 ─────────────────────────────────────────────────────────────────

test.describe('Journey 1: Customer', () => {
  // ── Part A: Registration ───────────────────────────────────────────────────

  test('registers a new account and lands on the dashboard with 0 points', async ({ page }) => {
    await page.goto('/register')

    await page.fill('#phone', NEW_PHONE)
    await page.fill('#username', 'E2E New User')
    await page.fill('#password', NEW_PASSWORD)

    await page.getByRole('button', { name: 'Create Account' }).click()

    // RegisterForm auto-signs the new user in and redirects to /dashboard
    await page.waitForURL('**/dashboard')

    // The PointsCard renders the balance in a large text element; new accounts start at 0
    await expect(page.locator('.text-6xl')).toHaveText('0')
    await expect(page.getByText('Your Points', { exact: true })).toBeVisible()
  })

  // ── Part B: View points ────────────────────────────────────────────────────

  test('views the points balance on the dashboard', async ({ page }) => {
    await loginAsCustomer(page, CUSTOMER_PHONE, CUSTOMER_PASSWORD)

    // PointsCard shows the balance seeded by global-setup
    await expect(page.locator('.text-6xl')).toHaveText(SEED_POINTS.toLocaleString('en'))
    await expect(page.getByText('Your Points', { exact: true })).toBeVisible()
    // Username is shown above the balance (also appears in nav, so scope to main)
    await expect(page.getByRole('main').getByText(process.env.E2E_CUSTOMER_USERNAME!, { exact: true })).toBeVisible()
  })

  // ── Part C: Redeem a reward ────────────────────────────────────────────────

  test('requests a reward redemption and cancels it', async ({ page }) => {
    await loginAsCustomer(page, CUSTOMER_PHONE, CUSTOMER_PASSWORD)
    await page.goto('/rewards')

    // RewardCard: outer container has classes `rounded-2xl shadow-sm`
    const rewardCard = page.locator('.rounded-2xl.shadow-sm', { hasText: REWARD_NAME })
    await expect(rewardCard).toBeVisible()

    // Verify the customer can afford the reward
    await expect(rewardCard.getByRole('button', { name: 'Request' })).toBeEnabled()

    // ── Open the confirmation modal ──────────────────────────────────────────
    await rewardCard.getByRole('button', { name: 'Request' }).click()
    await expect(page.getByRole('heading', { name: 'Request Redemption' })).toBeVisible()

    // Modal shows remaining-points preview
    const rewardPts = parseInt(process.env.E2E_REWARD_POINTS ?? '100', 10)
    await expect(page.getByText(`${(SEED_POINTS - rewardPts).toLocaleString('en')}`)).toBeVisible()

    // ── Submit the request ───────────────────────────────────────────────────
    await page.getByRole('button', { name: 'Send Request' }).click()

    // Reward card transitions to pending state
    await expect(rewardCard.getByText('Pending...')).toBeVisible()

    // ── Cancel the request (keeps the customer state clean for the next run) ─
    await rewardCard.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('heading', { name: 'Cancel Request' })).toBeVisible()
    await page.getByRole('button', { name: 'Cancel Request' }).click()

    // Card returns to its requestable state
    await expect(rewardCard.getByRole('button', { name: 'Request' })).toBeVisible()
  })
})
