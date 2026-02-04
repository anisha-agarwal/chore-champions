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

    test('displays page header with My Profile title', async ({ page }) => {
      await page.goto('/me')

      // Header should be visible with title
      await expect(page.getByText('My Profile')).toBeVisible()
    })

    test('displays avatar section with change photo caption', async ({ page }) => {
      await page.goto('/me')

      // Avatar button should be visible
      const avatarButton = page.getByRole('button', { name: 'Change avatar' })
      await expect(avatarButton).toBeVisible()

      // Caption should be visible
      await expect(page.getByText('Tap to change avatar')).toBeVisible()
    })

    test('avatar shows edit overlay on hover', async ({ page }) => {
      await page.goto('/me')

      const avatarButton = page.getByRole('button', { name: 'Change avatar' })

      // Edit overlay should be hidden initially
      const overlay = avatarButton.locator('span.opacity-0')
      await expect(overlay).toBeVisible()

      // Hover over avatar
      await avatarButton.hover()

      // Overlay should become visible (opacity changes via group-hover)
      await expect(avatarButton.locator('span.group-hover\\:opacity-100')).toBeVisible()
    })

    test('displays section headers', async ({ page }) => {
      await page.goto('/me')

      // Section headers should be visible (CSS transforms to uppercase)
      await expect(page.getByText('Personal Info')).toBeVisible()
      await expect(page.getByText('Role')).toBeVisible()
    })

    test('displays form with underline inputs', async ({ page }) => {
      await page.goto('/me')

      // Form fields should be visible
      await expect(page.getByText('Display Name')).toBeVisible()
      await expect(page.getByText('Nickname')).toBeVisible()

      // Role selector buttons
      await expect(page.getByRole('button', { name: 'Parent' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Kid' })).toBeVisible()
    })

    test('displays Save Changes button', async ({ page }) => {
      await page.goto('/me')

      await expect(page.getByRole('button', { name: 'Save Changes' })).toBeVisible()
    })

    test('opens avatar modal when clicking avatar', async ({ page }) => {
      await page.goto('/me')

      // Click the avatar button
      const avatarButton = page.getByRole('button', { name: 'Change avatar' })
      await avatarButton.click()

      // Modal should open
      await expect(page.getByText('Choose Avatar')).toBeVisible()
    })

    test('can close avatar modal', async ({ page }) => {
      await page.goto('/me')

      // Open modal
      const avatarButton = page.getByRole('button', { name: 'Change avatar' })
      await avatarButton.click()
      await expect(page.getByText('Choose Avatar')).toBeVisible()

      // Close modal (press Escape)
      await page.keyboard.press('Escape')
      await expect(page.getByText('Choose Avatar')).not.toBeVisible()
    })

    test('sign out button is visible', async ({ page }) => {
      await page.goto('/me')

      await expect(page.getByRole('button', { name: 'Sign Out' })).toBeVisible()
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

    test('underline inputs have animated focus effect', async ({ page }) => {
      await page.goto('/me')

      // Focus on display name input
      const displayNameInput = page.locator('input[id="display-name"]')

      // Underline should start with width 0
      const underline = page.locator('input[id="display-name"] + div')
      await expect(underline).toHaveClass(/w-0/)

      // Focus the input
      await displayNameInput.focus()

      // The animated underline should expand to full width
      await expect(underline).toHaveClass(/w-full/)
      await expect(underline).toHaveClass(/bg-purple-600/)
    })

    test('page has mobile-first max-width container', async ({ page }) => {
      await page.goto('/me')

      // Main content should have max-w-md class (448px)
      const container = page.locator('main .max-w-md')
      await expect(container).toBeVisible()
    })
  })
})
