import type { Page } from '@playwright/test'

/**
 * Logs in as a customer using phone + password and waits for the dashboard.
 * The customer login form derives the Supabase email from the phone number.
 */
export async function loginAsCustomer(page: Page, phone: string, password: string): Promise<void> {
  await page.goto('/login')
  await page.fill('#phone', phone)
  await page.fill('#password', password)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL('**/dashboard')
}

/**
 * Logs in as a staff admin or superadmin and waits for the admin dashboard.
 * identifier can be either a username (maps to @akoatp-staff.com) or a full email.
 */
export async function loginAsAdmin(page: Page, identifier: string, password: string): Promise<void> {
  await page.goto('/admin/login')
  await page.fill('#identifier', identifier)
  await page.fill('#password', password)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL('**/admin/dashboard')
}
