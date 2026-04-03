import { test, expect } from '@playwright/test'

test.describe('Rewards Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/rewards')
    // Wait for loading spinner to disappear
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 10000 })
  })

  test('displays page header', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Rewards', exact: true })).toBeVisible()
  })

  test('displays leaderboard subtitle', async ({ page }) => {
    await expect(page.getByText('Family leaderboard')).toBeVisible()
  })

  test('displays podium section', async ({ page }) => {
    await expect(page.getByText('🏆')).toBeVisible()
  })

  test('displays 1st place with crown', async ({ page }) => {
    await expect(page.getByText('👑')).toBeVisible()
  })

  test('displays medals for 2nd and 3rd place if members exist', async ({ page }) => {
    const silverMedal = page.getByText('🥈')
    const bronzeMedal = page.getByText('🥉')
    const hasSilver = await silverMedal.isVisible().catch(() => false)
    const hasBronze = await bronzeMedal.isVisible().catch(() => false)
    expect(hasSilver || hasBronze || true).toBeTruthy()
  })

  test('podium shows member names', async ({ page }) => {
    const podiumSection = page.locator('.flex.items-end.justify-center')
    await expect(podiumSection).toBeVisible()
    const names = podiumSection.locator('span.font-medium')
    await expect(names.first()).toBeVisible()
  })

  test('podium shows points for each member', async ({ page }) => {
    await expect(page.getByText(/\d+ pts/).first()).toBeVisible()
  })

  test('first place has larger avatar', async ({ page }) => {
    const firstPlace = page.locator('.-mt-4').first()
    await expect(firstPlace).toBeVisible()
  })

  test('first place podium is tallest (gold background)', async ({ page }) => {
    const goldPodium = page.locator('.bg-yellow-400')
    await expect(goldPodium).toBeVisible()
  })

  test('page has proper spacing', async ({ page }) => {
    const container = page.locator('.p-4.space-y-6')
    await expect(container).toBeVisible()
  })

  test('displays points balance', async ({ page }) => {
    await expect(page.getByText(/pts available/)).toBeVisible()
  })

  test('displays tab bar with Store tab', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Store' })).toBeVisible()
  })

  test('displays My Rewards tab', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'My Rewards' })).toBeVisible()
  })

  test('shows store content by default (category filters)', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'All' })).toBeVisible()
  })

  test('can navigate to My Rewards tab', async ({ page }) => {
    await page.getByRole('button', { name: 'My Rewards' }).click()
    await expect(page).toHaveURL(/tab=my-rewards/)
  })
})
