import { test, expect } from '@playwright/test'
import { loginAsCustomer, loginAsAdmin } from './helpers/auth'

// ── Env ───────────────────────────────────────────────────────────────────────
const CUSTOMER_PHONE     = process.env.E2E_CUSTOMER_PHONE!
const CUSTOMER_PASSWORD  = process.env.E2E_CUSTOMER_PASSWORD!
const SUPERADMIN_EMAIL   = process.env.E2E_SUPERADMIN_EMAIL!
const SUPERADMIN_PASSWORD = process.env.E2E_SUPERADMIN_PASSWORD!

// ── Journey 4 ─────────────────────────────────────────────────────────────────

test.describe('Journey 4: Auth redirects', () => {
  test('customer logs in with correct credentials and lands on /dashboard', async ({ page }) => {
    await loginAsCustomer(page, CUSTOMER_PHONE, CUSTOMER_PASSWORD)

    // Verify the page content shows the points section
    await expect(page.getByText('Your Points', { exact: true })).toBeVisible()
  })

  test('admin logs in with correct credentials and lands on /admin/dashboard', async ({ page }) => {
    await loginAsAdmin(page, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD)

    // Verify the admin dashboard actually rendered
    await expect(page.getByText('Dashboard')).toBeVisible()
  })

  test('unauthenticated visit to /dashboard redirects to /login', async ({ page }) => {
    // Navigate to a protected customer route without authentication
    await page.goto('/dashboard')

    // Middleware should redirect to /login
    await page.waitForURL('**/login')

    // Verify the login page is displayed
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
  })
})
