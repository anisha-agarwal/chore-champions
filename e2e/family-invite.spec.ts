import { test, expect } from '@playwright/test'

test.describe('Family Invite by Email', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/family')
    await expect(page.locator('header h1')).toBeVisible({ timeout: 10000 })
  })

  test('invite modal shows email tab', async ({ page }) => {
    await page.getByRole('button', { name: 'Invite' }).click()

    // Both tabs should be visible
    await expect(page.getByText('Share Code')).toBeVisible()
    await expect(page.getByText('Invite by Email')).toBeVisible()

    // Click on email tab
    await page.getByText('Invite by Email').click()

    // Email form should appear
    await expect(page.getByLabel('Email Address')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Send Invite' })).toBeVisible()
  })

  test('send invite by email shows error for non-existent user', async ({ page }) => {
    await page.getByRole('button', { name: 'Invite' }).click()
    await page.getByText('Invite by Email').click()

    // Enter a non-existent email
    await page.getByLabel('Email Address').fill('nonexistent@example.com')
    await page.getByRole('button', { name: 'Send Invite' }).click()

    // Should show an error message (exact text depends on whether migration has been applied)
    const errorBox = page.locator('.bg-red-50')
    await expect(errorBox).toBeVisible({ timeout: 5000 })
  })

  test('can switch between tabs', async ({ page }) => {
    await page.getByRole('button', { name: 'Invite' }).click()

    // Default tab shows invite code
    await expect(page.getByText('Invite Code')).toBeVisible()

    // Switch to email tab
    await page.getByText('Invite by Email').click()
    await expect(page.getByLabel('Email Address')).toBeVisible()

    // Switch back to code tab
    await page.getByText('Share Code').click()
    await expect(page.getByText('Invite Code')).toBeVisible()
  })
})
