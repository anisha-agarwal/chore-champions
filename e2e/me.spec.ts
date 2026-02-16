import { test, expect } from '@playwright/test'

test.describe('Me Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/me')
  })

  test('displays page header with My Profile title', async ({ page }) => {
    await expect(page.getByText('My Profile')).toBeVisible()
  })

  test('displays avatar section with change photo caption', async ({ page }) => {
    const avatarButton = page.getByRole('button', { name: 'Change avatar' })
    await expect(avatarButton).toBeVisible()

    await expect(page.getByText('Tap to change avatar')).toBeVisible()
  })

  test('avatar shows edit overlay on hover', async ({ page }) => {
    const avatarButton = page.getByRole('button', { name: 'Change avatar' })

    const overlay = avatarButton.locator('span.opacity-0')
    await expect(overlay).toBeVisible()

    await avatarButton.hover()

    await expect(avatarButton.locator('span.group-hover\\:opacity-100')).toBeVisible()
  })

  test('displays section headers', async ({ page }) => {
    // Section headers have uppercase CSS class but source text is normal case
    await expect(page.getByRole('heading', { name: 'Personal Info' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Role' })).toBeVisible()
  })

  test('displays form with underline inputs', async ({ page }) => {
    await expect(page.getByText('Display Name')).toBeVisible()
    await expect(page.getByText('Nickname')).toBeVisible()

    await expect(page.getByRole('button', { name: 'Parent' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Kid' })).toBeVisible()
  })

  test('displays Save Changes button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Save Changes' })).toBeVisible()
  })

  test('opens avatar modal when clicking avatar', async ({ page }) => {
    const avatarButton = page.getByRole('button', { name: 'Change avatar' })
    await avatarButton.click()

    await expect(page.getByText('Choose Avatar')).toBeVisible()
  })

  test('opens avatar modal', async ({ page }) => {
    const avatarButton = page.getByRole('button', { name: 'Change avatar' })
    await avatarButton.click()

    // Modal title should be visible
    await expect(page.getByText('Choose Avatar')).toBeVisible()
  })

  test('sign out button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Sign Out' })).toBeVisible()
  })

  test('role selector shows current role', async ({ page }) => {
    // Logged in as parent, so Parent should be selected
    const parentButton = page.getByRole('button', { name: 'Parent' })
    const kidButton = page.getByRole('button', { name: 'Kid' })

    await expect(parentButton).toBeVisible()
    await expect(kidButton).toBeVisible()

    // Parent should be highlighted (we're logged in as parent)
    await expect(parentButton).toHaveClass(/bg-purple-600/)
  })

  test('underline inputs have animated focus effect', async ({ page }) => {
    const displayNameInput = page.locator('input[id="display-name"]')
    const underline = page.locator('input[id="display-name"] + div')
    await expect(underline).toHaveClass(/w-0/)

    await displayNameInput.focus()

    await expect(underline).toHaveClass(/w-full/)
    await expect(underline).toHaveClass(/bg-purple-600/)
  })

  test('displays email address', async ({ page }) => {
    await expect(page.getByText('Email')).toBeVisible()
    const emailInput = page.locator('input[id="email"]')
    await expect(emailInput).toBeVisible()
    await expect(emailInput).toHaveAttribute('readOnly', '')
  })

  test('change password link opens modal', async ({ page }) => {
    await page.getByRole('button', { name: 'Change Password' }).click()
    await expect(page.getByText('New Password')).toBeVisible()
    await expect(page.getByText('Confirm Password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Update Password' })).toBeVisible()
  })

  test('sign out button is in header', async ({ page }) => {
    const header = page.locator('header')
    await expect(header.getByRole('button', { name: 'Sign Out' })).toBeVisible()
  })

  test('page has mobile-first max-width container', async ({ page }) => {
    const container = page.locator('main .max-w-md')
    await expect(container).toBeVisible()
  })
})
