import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers/auth'

// ── Env ───────────────────────────────────────────────────────────────────────
const SUPERADMIN_EMAIL    = process.env.E2E_SUPERADMIN_EMAIL!
const SUPERADMIN_PASSWORD = process.env.E2E_SUPERADMIN_PASSWORD!
const CUSTOMER_PHONE      = process.env.E2E_CUSTOMER_PHONE!
const CUSTOMER_USERNAME   = process.env.E2E_CUSTOMER_USERNAME!

// Hours entered in the form and the expected point result (10 pts/hr)
const HOURS_TO_ADD    = '2'
const EXPECTED_POINTS = 20

// ── Journey 2 ─────────────────────────────────────────────────────────────────

test.describe('Journey 2: Admin adds points to a customer', () => {
  test.beforeEach(async ({ page }) => {
    // The superadmin has all admin capabilities (add points, manage customers)
    await loginAsAdmin(page, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD)
  })

  test('searches for a customer by phone number', async ({ page }) => {
    await page.goto('/admin/customers')

    await page.getByPlaceholder('Search by phone number...').fill(CUSTOMER_PHONE)
    await page.getByRole('button', { name: 'Search' }).click()

    // CustomerRow shows phone in a small text element below the username
    await expect(page.getByText(CUSTOMER_PHONE)).toBeVisible()
    await expect(page.getByText(CUSTOMER_USERNAME)).toBeVisible()
  })

  test('opens the customer detail page and adds points', async ({ page }) => {
    // Navigate directly to the search result
    await page.goto(`/admin/customers?q=${CUSTOMER_PHONE}`)

    // Click the customer row (shows phone as sub-text inside the link)
    await page.getByText(CUSTOMER_PHONE).click()
    await page.waitForURL(/\/admin\/customers\/[0-9a-f-]+/)

    // ── Verify the customer detail panel ────────────────────────────────────
    await expect(page.getByText(CUSTOMER_USERNAME)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Add Points' })).toBeVisible()

    // ── Fill the AddPointsForm ───────────────────────────────────────────────
    await page.fill('#hours', HOURS_TO_ADD)

    // Preview text: "Will add 20 points for 2h of play"
    await expect(page.getByText(`Will add`)).toBeVisible()
    await expect(page.getByText(`${EXPECTED_POINTS} points`)).toBeVisible()

    // ── Submit ───────────────────────────────────────────────────────────────
    await page.getByRole('button', { name: 'Add Points' }).click()

    // Success message: "Added 20 points to E2ECustomer."
    await expect(
      page.getByText(new RegExp(`Added ${EXPECTED_POINTS} points to ${CUSTOMER_USERNAME}`))
    ).toBeVisible()
  })
})
