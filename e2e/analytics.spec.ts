import { test, expect } from '@playwright/test'

test.describe('Analytics - Child Stats Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/me')
    await expect(page.getByText('My Profile')).toBeVisible({ timeout: 10000 })
  })

  test('Stats tab is visible and clickable', async ({ page }) => {
    const statsButton = page.getByRole('button', { name: 'Stats' })
    await expect(statsButton).toBeVisible()
    await statsButton.click()

    // Should show either analytics content or empty state
    await expect(
      page.getByText('Points over time').or(page.getByText('Your adventure is just beginning'))
    ).toBeVisible({ timeout: 10000 })
  })

  test('Stats tab shows weekly summary or empty state', async ({ page }) => {
    await page.getByRole('button', { name: 'Stats' }).click()

    // Wait for loading to finish
    await expect(page.locator('.animate-pulse').first()).toBeHidden({ timeout: 15000 })

    // Should show either the weekly stats section or the empty state CTA
    await expect(
      page.getByText('Quests this week').or(page.getByText('Go to Quests'))
    ).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Analytics - Parent Analytics Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/analytics')
    await expect(page.getByRole('heading', { name: 'Family Analytics' })).toBeVisible({ timeout: 10000 })
  })

  test('displays Family Analytics header', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Family Analytics' })).toBeVisible()
    await expect(page.getByText('Track your family')).toBeVisible()
  })

  test('shows summary stats or empty state', async ({ page }) => {
    // Wait for loading to finish
    await expect(page.locator('.animate-pulse').first()).toBeHidden({ timeout: 15000 })

    // Should show either summary stats or the empty/invite-kids state
    await expect(
      page.getByText('Completion rate').or(page.getByText('Invite your kids'))
    ).toBeVisible({ timeout: 10000 })
  })

  test('renders chart sections when data exists', async ({ page }) => {
    // Wait for loading to finish
    await expect(page.locator('.animate-pulse').first()).toBeHidden({ timeout: 15000 })

    // If there are children with data, charts should render
    const hasData = await page.getByText('Completion rate').isVisible({ timeout: 3000 }).catch(() => false)

    if (hasData) {
      await expect(page.getByText('Child comparison')).toBeVisible()
      await expect(page.getByText('Activity trend')).toBeVisible()
      await expect(page.getByText('Points distribution')).toBeVisible()
    }
  })
})

test.describe('Analytics - Time Range Switching', () => {
  test('time range buttons update content on Stats tab', async ({ page }) => {
    await page.goto('/me')
    await expect(page.getByText('My Profile')).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: 'Stats' }).click()

    // Wait for loading to finish
    await expect(page.locator('.animate-pulse').first()).toBeHidden({ timeout: 15000 })

    // Only test time range if analytics data is loaded (not empty state)
    const hasData = await page.getByText('Points over time').isVisible({ timeout: 3000 }).catch(() => false)

    if (hasData) {
      const timeRangeGroup = page.getByRole('group', { name: 'Select time range' })
      await expect(timeRangeGroup).toBeVisible()

      // Click 4w
      await timeRangeGroup.getByRole('button', { name: '4w' }).click()
      await expect(timeRangeGroup.getByRole('button', { name: '4w' })).toHaveAttribute('aria-pressed', 'true')

      // Click 26w
      await timeRangeGroup.getByRole('button', { name: '26w' }).click()
      await expect(timeRangeGroup.getByRole('button', { name: '26w' })).toHaveAttribute('aria-pressed', 'true')

      // Click 12w (default)
      await timeRangeGroup.getByRole('button', { name: '12w' }).click()
      await expect(timeRangeGroup.getByRole('button', { name: '12w' })).toHaveAttribute('aria-pressed', 'true')
    }
  })

  test('time range buttons on parent analytics page', async ({ page }) => {
    await page.goto('/analytics')
    await expect(page.getByRole('heading', { name: 'Family Analytics' })).toBeVisible({ timeout: 10000 })

    // Wait for loading to finish
    await expect(page.locator('.animate-pulse').first()).toBeHidden({ timeout: 15000 })

    const hasData = await page.getByText('Completion rate').isVisible({ timeout: 3000 }).catch(() => false)

    if (hasData) {
      const timeRangeGroup = page.getByRole('group', { name: 'Select time range' })
      await expect(timeRangeGroup).toBeVisible()

      // Switch ranges and verify the pressed state updates
      await timeRangeGroup.getByRole('button', { name: '4w' }).click()
      await expect(timeRangeGroup.getByRole('button', { name: '4w' })).toHaveAttribute('aria-pressed', 'true')

      await timeRangeGroup.getByRole('button', { name: '26w' }).click()
      await expect(timeRangeGroup.getByRole('button', { name: '26w' })).toHaveAttribute('aria-pressed', 'true')
    }
  })
})

test.describe('Analytics - Family Page Link', () => {
  test('Family Analytics link navigates to /analytics', async ({ page }) => {
    await page.goto('/family')
    await expect(page.locator('header h1')).toBeVisible({ timeout: 10000 })

    const analyticsLink = page.getByRole('link', { name: /Family Analytics/i })
    await expect(analyticsLink).toBeVisible()
    await analyticsLink.click()

    await expect(page).toHaveURL(/\/analytics/)
    await expect(page.getByRole('heading', { name: 'Family Analytics' })).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Analytics - Auth Gating', () => {
  // Use child authentication
  test.use({ storageState: '.auth/child.json' })

  test('child navigating to /analytics is redirected to /me', async ({ page }) => {
    await page.goto('/analytics')

    // Should be redirected away from analytics
    await expect(page).not.toHaveURL(/\/analytics/, { timeout: 10000 })
    // Should end up on /me (the redirect target for non-parents)
    await expect(page).toHaveURL(/\/me/)
    await expect(page.getByText('My Profile')).toBeVisible({ timeout: 10000 })
  })
})
