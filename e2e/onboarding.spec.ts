import { test, expect } from '@playwright/test'

test.describe('Onboarding Flow', () => {
  test('authenticated user can access onboarding page', async ({ page }) => {
    // Parent project already has stored auth state — no manual login needed
    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')

    // Should be on the onboarding page (not redirected to login)
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 10000 })
  })

  test('onboarding page shows welcome heading', async ({ page }) => {
    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible({ timeout: 10000 })
  })

  test('onboarding page shows role and avatar selection for users with family', async ({ page }) => {
    // Test parent already has a family, so should skip family step
    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')

    // Should see role & avatar step (family step skipped)
    await expect(page.getByText(/choose your role/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: 'Parent' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Kid' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible()
  })

  test('selecting role and avatar then clicking continue redirects to quests', async ({ page }) => {
    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')

    // Wait for role & avatar step to load
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible({ timeout: 10000 })

    // Select parent role
    await page.getByRole('button', { name: 'Parent' }).click()

    // Select an avatar
    await page.getByAltText('Fox').click()

    // Click continue
    await page.getByRole('button', { name: 'Continue' }).click()

    // Should redirect to quests
    await expect(page).toHaveURL(/\/quests/, { timeout: 15000 })
  })
})
