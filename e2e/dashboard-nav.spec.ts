import { test, expect } from '@playwright/test'

test.describe('Dashboard Navigation', () => {
  test('navigates between all dashboard sections via bottom nav', async ({ page }) => {
    await page.goto('/quests')
    await expect(page.getByRole('heading', { name: 'Quests' })).toBeVisible({ timeout: 10000 })

    // Navigate to Family
    await page.getByRole('link', { name: /family/i }).click()
    await expect(page.locator('header h1')).toBeVisible({ timeout: 10000 })

    // Navigate to Rewards
    await page.getByRole('link', { name: /rewards/i }).click()
    await expect(page.getByRole('heading', { name: 'Rewards', exact: true })).toBeVisible({ timeout: 10000 })

    // Navigate to Me
    await page.getByRole('link', { name: /^me$/i }).click()
    await expect(page.getByText('My Profile')).toBeVisible({ timeout: 10000 })

    // Navigate back to Quests
    await page.getByRole('link', { name: /quests/i }).click()
    await expect(page.getByRole('heading', { name: 'Quests' })).toBeVisible({ timeout: 10000 })
  })

  test('active nav item is highlighted with purple color', async ({ page }) => {
    await page.goto('/quests')
    await expect(page.getByRole('heading', { name: 'Quests' })).toBeVisible({ timeout: 10000 })

    // Quests link should be active (purple)
    const questsLink = page.getByRole('link', { name: /quests/i })
    await expect(questsLink).toHaveClass(/text-purple-600/)

    // Other links should not be active
    const familyLink = page.getByRole('link', { name: /family/i })
    await expect(familyLink).toHaveClass(/text-gray-400/)
  })

  test('active state updates when navigating', async ({ page }) => {
    await page.goto('/quests')
    await expect(page.getByRole('heading', { name: 'Quests' })).toBeVisible({ timeout: 10000 })

    // Navigate to Rewards
    await page.getByRole('link', { name: /rewards/i }).click()
    await expect(page.getByRole('heading', { name: 'Rewards', exact: true })).toBeVisible({ timeout: 10000 })

    // Rewards link should now be active
    const rewardsLink = page.getByRole('link', { name: /rewards/i })
    await expect(rewardsLink).toHaveClass(/text-purple-600/)

    // Quests link should no longer be active
    const questsLink = page.getByRole('link', { name: /quests/i })
    await expect(questsLink).toHaveClass(/text-gray-400/)
  })

  test('bottom nav bar is visible on all dashboard pages', async ({ page }) => {
    const nav = page.getByRole('navigation')

    await page.goto('/quests')
    await expect(nav).toBeVisible({ timeout: 10000 })

    await page.goto('/family')
    await expect(nav).toBeVisible({ timeout: 10000 })

    await page.goto('/rewards')
    await expect(nav).toBeVisible({ timeout: 10000 })

    await page.goto('/me')
    await expect(nav).toBeVisible({ timeout: 10000 })
  })
})
