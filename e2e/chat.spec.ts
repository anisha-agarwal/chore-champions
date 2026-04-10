import { test, expect } from '@playwright/test'

test.describe('Chat FAB', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/quests')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 10000 })
  })

  test('shows chat FAB on quests page', async ({ page }) => {
    const fab = page.getByRole('button', { name: 'Open chat' })
    await expect(fab).toBeVisible()
  })

  test('opens chat window with Parenting Assistant header', async ({ page }) => {
    await page.getByRole('button', { name: 'Open chat' }).click()
    await expect(page.getByText('Parenting Assistant')).toBeVisible()
  })

  test('shows quick action buttons in chat window', async ({ page }) => {
    await page.getByRole('button', { name: 'Open chat' }).click()
    await expect(page.getByText('Suggest quests')).toBeVisible()
    await expect(page.getByText('Weekly report')).toBeVisible()
  })

  test('shows message input in chat window', async ({ page }) => {
    await page.getByRole('button', { name: 'Open chat' }).click()
    await expect(page.getByPlaceholder('Type a message…')).toBeVisible()
  })

  test('closes chat window via close button', async ({ page }) => {
    await page.getByRole('button', { name: 'Open chat' }).click()
    await expect(page.getByText('Parenting Assistant')).toBeVisible()
    await page.getByRole('button', { name: 'Close chat' }).first().click()
    await expect(page.getByText('Parenting Assistant')).not.toBeVisible()
  })

  test('add-quest FAB is accessible after closing chat', async ({ page }) => {
    // Open chat
    await page.getByRole('button', { name: 'Open chat' }).click()
    await expect(page.getByText('Parenting Assistant')).toBeVisible()
    // Close chat
    await page.getByRole('button', { name: 'Close chat' }).first().click()
    await expect(page.getByText('Parenting Assistant')).not.toBeVisible()
    // Add-quest FAB should be visible and clickable
    const addFab = page.getByTestId('add-quest-fab')
    await expect(addFab).toBeVisible()
    await addFab.click()
    await expect(page.getByText('New Quest')).toBeVisible()
  })

  test('chat FAB visible on rewards page', async ({ page }) => {
    await page.goto('/rewards')
    await page.waitForLoadState('networkidle')
    const fab = page.getByRole('button', { name: 'Open chat' })
    await expect(fab).toBeVisible()
  })

  test('chat FAB visible on family page', async ({ page }) => {
    await page.goto('/family')
    await page.waitForLoadState('networkidle')
    const fab = page.getByRole('button', { name: 'Open chat' })
    await expect(fab).toBeVisible()
  })
})
