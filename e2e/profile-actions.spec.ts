import { test, expect } from '@playwright/test'

test.describe('Profile Actions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/me')
    await expect(page.getByText('My Profile')).toBeVisible({ timeout: 10000 })
  })

  test('can edit display name and save', async ({ page }) => {
    // Get the current display name
    const displayNameInput = page.locator('input[id="display-name"]')
    const originalName = await displayNameInput.inputValue()

    // Change the display name
    const testName = `Test User ${Date.now()}`
    await displayNameInput.clear()
    await displayNameInput.fill(testName)

    // Save changes
    await page.getByRole('button', { name: 'Save Changes' }).click()

    // Wait for save to complete
    await page.waitForTimeout(2000)

    // Reload the page to verify persistence
    await page.reload()
    await expect(page.getByText('My Profile')).toBeVisible({ timeout: 10000 })

    // Verify the name was saved
    await expect(displayNameInput).toHaveValue(testName)

    // Restore original name
    await displayNameInput.clear()
    await displayNameInput.fill(originalName)
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await page.waitForTimeout(1500)
  })

  test('can open and close avatar modal', async ({ page }) => {
    // Open avatar modal
    await page.getByRole('button', { name: 'Change avatar' }).click()
    await expect(page.getByText('Choose Avatar')).toBeVisible()

    // Should show avatar options
    await expect(page.getByText('Panther')).toBeVisible()
    await expect(page.getByText('Fox')).toBeVisible()

    // Close modal using X button
    await page.locator('.fixed.inset-0.z-50 button').first().click()
    await expect(page.getByText('Choose Avatar')).not.toBeVisible()
  })

  test('can change avatar and verify persistence', async ({ page }) => {
    // Open avatar modal
    await page.getByRole('button', { name: 'Change avatar' }).click()
    await expect(page.getByText('Choose Avatar')).toBeVisible()

    // Click on a different avatar (Fox)
    await page.getByText('Fox').click()

    // Modal should close
    await expect(page.getByText('Choose Avatar')).not.toBeVisible({ timeout: 5000 })

    // Reload to verify persistence
    await page.reload()
    await expect(page.getByText('My Profile')).toBeVisible({ timeout: 10000 })

    // Open avatar modal again to check which is selected
    await page.getByRole('button', { name: 'Change avatar' }).click()
    await expect(page.getByText('Choose Avatar')).toBeVisible()

    // Fox avatar button should have a ring indicating it's selected
    const foxButton = page.locator('button').filter({ hasText: 'Fox' })
    await expect(foxButton).toHaveClass(/ring-2/)

    // Close modal
    await page.locator('.fixed.inset-0.z-50 button').first().click()
  })

  test('can open change password modal', async ({ page }) => {
    await page.getByRole('button', { name: 'Change Password' }).click()

    await expect(page.getByText('New Password')).toBeVisible()
    await expect(page.getByText('Confirm Password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Update Password' })).toBeVisible()
  })

  test('password validation shows error for short password', async ({ page }) => {
    await page.getByRole('button', { name: 'Change Password' }).click()

    await page.getByLabel('New Password').fill('abc')
    await page.getByLabel('Confirm Password').fill('abc')
    await page.getByRole('button', { name: 'Update Password' }).click()

    await expect(page.getByText(/at least 6 characters/i)).toBeVisible()
  })

  test('password validation shows error for mismatched passwords', async ({ page }) => {
    await page.getByRole('button', { name: 'Change Password' }).click()

    await page.getByLabel('New Password').fill('password123')
    await page.getByLabel('Confirm Password').fill('differentpass')
    await page.getByRole('button', { name: 'Update Password' }).click()

    await expect(page.getByText(/do not match/i)).toBeVisible()
  })
})
