import { test, expect } from '@playwright/test'

// These tests do not use any auth storage state — the admin dashboard has its own password auth
const ADMIN_PASSWORD = process.env.ADMIN_OBSERVABILITY_PASSWORD ?? 'test-admin-password'

test.describe('Admin Observability Dashboard', () => {
  test('redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/admin/observability')
    await expect(page).toHaveURL(/\/admin\/observability\/login/)
  })

  test('login page renders password form', async ({ page }) => {
    await page.goto('/admin/observability/login')
    await expect(page.getByLabel('Admin Password')).toBeVisible()
    await expect(page.getByRole('button', { name: /Sign In/i })).toBeVisible()
  })

  test('shows error on wrong password', async ({ page }) => {
    await page.goto('/admin/observability/login')
    await page.getByLabel('Admin Password').fill('wrong-password')
    await page.getByRole('button', { name: /Sign In/i }).click()

    // Should stay on login page
    await expect(page).toHaveURL(/\/admin\/observability\/login/)
  })

  test('logs in with correct password and shows dashboard', async ({ page }) => {
    await page.goto('/admin/observability/login')
    await page.getByLabel('Admin Password').fill(ADMIN_PASSWORD)
    await page.getByRole('button', { name: /Sign In/i }).click()

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/admin\/observability$/)

    // Dashboard heading should be visible
    await expect(page.getByRole('heading', { name: /Observability Dashboard/i })).toBeVisible()
  })

  test('dashboard renders all 4 panels', async ({ page }) => {
    // Login first
    await page.goto('/admin/observability/login')
    await page.getByLabel('Admin Password').fill(ADMIN_PASSWORD)
    await page.getByRole('button', { name: /Sign In/i }).click()
    await expect(page).toHaveURL(/\/admin\/observability$/)

    // Check panel headings are visible (they load asynchronously)
    await expect(page.getByRole('heading', { name: 'Health' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Errors' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Performance' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Usage' })).toBeVisible()
  })

  test('time range selector changes the range', async ({ page }) => {
    await page.goto('/admin/observability/login')
    await page.getByLabel('Admin Password').fill(ADMIN_PASSWORD)
    await page.getByRole('button', { name: /Sign In/i }).click()
    await expect(page).toHaveURL(/\/admin\/observability$/)

    // Click 7d range
    await page.getByRole('button', { name: '7d' }).click()
    await expect(page).toHaveURL(/range=7d/)
  })

  test('logout button redirects to login', async ({ page }) => {
    await page.goto('/admin/observability/login')
    await page.getByLabel('Admin Password').fill(ADMIN_PASSWORD)
    await page.getByRole('button', { name: /Sign In/i }).click()
    await expect(page).toHaveURL(/\/admin\/observability$/)

    await page.getByRole('button', { name: /Logout/i }).click()
    await expect(page).toHaveURL(/\/admin\/observability\/login/)
  })
})
