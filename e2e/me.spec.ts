import { test, expect } from '@playwright/test'

test.describe('Me Page', () => {
  test('redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/me')

    await expect(page).toHaveURL('/login')
  })

  // These tests require authentication - skip in CI without auth setup
  // To run locally with auth, set up test user credentials
  test.describe('Authenticated', () => {
    test.skip(({ browserName }) => true, 'Requires authentication setup')

    test('displays profile header with avatar, name, and points', async ({ page }) => {
      await page.goto('/me')

      // Header should have horizontal layout with avatar on left
      await expect(page.locator('header')).toBeVisible()

      // Avatar should be visible and clickable
      const avatarButton = page.locator('header button').first()
      await expect(avatarButton).toBeVisible()

      // Name should be displayed
      await expect(page.locator('header h1')).toBeVisible()

      // Points should be displayed
      await expect(page.getByText('points')).toBeVisible()
    })

    test('displays profile form with two-column layout', async ({ page }) => {
      await page.goto('/me')

      // Form fields should be visible
      await expect(page.getByText('Display Name')).toBeVisible()
      await expect(page.getByText('Nickname')).toBeVisible()
      await expect(page.getByText('Role')).toBeVisible()

      // Role selector buttons
      await expect(page.getByRole('button', { name: 'Parent' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Kid' })).toBeVisible()

      // Save button should be centered
      await expect(page.getByRole('button', { name: 'Save Changes' })).toBeVisible()
    })

    test('opens avatar modal when clicking avatar', async ({ page }) => {
      await page.goto('/me')

      // Click the avatar button
      const avatarButton = page.locator('header button').first()
      await avatarButton.click()

      // Modal should open
      await expect(page.getByText('Choose Avatar')).toBeVisible()
    })

    test('can close avatar modal', async ({ page }) => {
      await page.goto('/me')

      // Open modal
      const avatarButton = page.locator('header button').first()
      await avatarButton.click()
      await expect(page.getByText('Choose Avatar')).toBeVisible()

      // Close modal (click outside or close button)
      await page.keyboard.press('Escape')
      await expect(page.getByText('Choose Avatar')).not.toBeVisible()
    })

    test('role selector is interactive', async ({ page }) => {
      await page.goto('/me')

      const parentButton = page.getByRole('button', { name: 'Parent' })
      const kidButton = page.getByRole('button', { name: 'Kid' })

      // Click Parent
      await parentButton.click()
      await expect(parentButton).toHaveClass(/bg-purple-600/)

      // Click Kid
      await kidButton.click()
      await expect(kidButton).toHaveClass(/bg-purple-600/)
    })

    test('sign out button is visible', async ({ page }) => {
      await page.goto('/me')

      await expect(page.getByRole('button', { name: 'Sign Out' })).toBeVisible()
    })

    test('displays role badge in header', async ({ page }) => {
      await page.goto('/me')

      // Role badge should show either Parent or Kid
      const badge = page.locator('.bg-gray-100.rounded-full')
      await expect(badge).toBeVisible()
    })
  })
})
