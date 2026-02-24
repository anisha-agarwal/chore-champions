import { test, expect } from '@playwright/test'

test.describe('Streaks Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/me')
    await expect(page.getByText('My Profile')).toBeVisible()
  })

  test('displays Profile and Streaks tab buttons', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Profile' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Streaks' })).toBeVisible()
  })

  test('shows profile content by default', async ({ page }) => {
    await expect(page.getByText('Personal Info')).toBeVisible()
  })

  test('switches to streaks tab', async ({ page }) => {
    await page.getByRole('button', { name: 'Streaks' }).click()

    // Should show streak-related content
    await expect(page.getByText('Active Day')).toBeVisible()
    await expect(page.getByText('Streak Freezes')).toBeVisible()
  })

  test('switches back to profile tab', async ({ page }) => {
    await page.getByRole('button', { name: 'Streaks' }).click()
    await expect(page.getByText('Active Day')).toBeVisible()

    await page.getByRole('button', { name: 'Profile' }).click()
    await expect(page.getByText('Personal Info')).toBeVisible()
  })

  test('streaks tab shows streak cards', async ({ page }) => {
    await page.getByRole('button', { name: 'Streaks' }).click()

    // Should show Active Day and Perfect Day cards
    await expect(page.getByText('Active Day')).toBeVisible()
    await expect(page.getByText('Perfect Day')).toBeVisible()
  })

  test('streaks tab shows freeze section with buy button', async ({ page }) => {
    await page.getByRole('button', { name: 'Streaks' }).click()

    await expect(page.getByText('Streak Freezes')).toBeVisible()
    await expect(page.getByRole('button', { name: /Buy Freeze/i })).toBeVisible()
  })

  test('milestone badges are visible in streak cards', async ({ page }) => {
    await page.getByRole('button', { name: 'Streaks' }).click()

    // Should show milestone badges (7d, 14d, etc.)
    const badges = page.getByText('7d')
    await expect(badges.first()).toBeVisible()
  })

  test('active streak count summary is shown', async ({ page }) => {
    await page.getByRole('button', { name: 'Streaks' }).click()

    await expect(page.getByText(/active streak/)).toBeVisible()
  })
})
