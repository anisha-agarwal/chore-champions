import { test, expect } from '@playwright/test'

// Sign-out test is isolated in its own project because it invalidates
// the server-side Supabase session, which would break parallel parent tests.

test.describe('Sign Out', () => {
  test('sign out redirects to login page', async ({ page }) => {
    await page.goto('/me')
    await expect(page.getByText('My Profile')).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: 'Sign Out' }).click()

    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
    await expect(page.getByRole('heading', { name: /chore champions/i })).toBeVisible()
  })
})
