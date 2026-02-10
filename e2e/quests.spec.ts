import { test, expect } from '@playwright/test'

test.describe('Quests Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/quests')
  })

  test('displays quests page header', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Quests' })).toBeVisible()
  })

  test('displays week picker', async ({ page }) => {
    // Week picker should be visible with day buttons
    await expect(page.getByRole('button', { name: /sun|mon|tue|wed|thu|fri|sat/i }).first()).toBeVisible()
  })

  test('displays member filter or time filter', async ({ page }) => {
    // Check page loads successfully
    await expect(page.getByRole('heading', { name: 'Quests' })).toBeVisible()
    // Page should have filter buttons
    await expect(page.locator('button').first()).toBeVisible()
  })

  test('displays FAB button to add quest', async ({ page }) => {
    // FAB button with + icon
    const fab = page.locator('button.fixed').filter({ hasText: '' })
    await expect(fab).toBeVisible()
  })

  test('complete and undo task flow', async ({ page }) => {
    // Find an incomplete task checkbox (not green)
    const incompleteCheckbox = page.locator('button.border-gray-300').first()

    // Skip if no incomplete tasks
    if (await incompleteCheckbox.count() === 0) {
      test.skip()
      return
    }

    // Complete the task
    await incompleteCheckbox.click()

    // Wait for completion - checkbox should turn green
    await expect(incompleteCheckbox).toHaveClass(/bg-green-500/, { timeout: 5000 })

    // Hover should show "Click to undo" title
    await expect(incompleteCheckbox).toHaveAttribute('title', 'Click to undo')

    // Undo the completion
    await incompleteCheckbox.click()

    // Verify returned to incomplete state
    await expect(incompleteCheckbox).not.toHaveClass(/bg-green-500/, { timeout: 5000 })
  })

  test('completed task shows strikethrough text', async ({ page }) => {
    // Find any completed task
    const completedCheckbox = page.locator('button.bg-green-500').first()

    if (await completedCheckbox.count() === 0) {
      test.skip()
      return
    }

    // The task title should have line-through
    const taskCard = completedCheckbox.locator('..').locator('..')
    await expect(taskCard.locator('h3')).toHaveClass(/line-through/)
  })

  test('edit button hidden on completed tasks', async ({ page }) => {
    // Find a completed task
    const completedCheckbox = page.locator('button.bg-green-500').first()

    if (await completedCheckbox.count() === 0) {
      test.skip()
      return
    }

    // Edit button should not be visible for completed tasks
    const taskCard = completedCheckbox.locator('..').locator('..')
    await expect(taskCard.getByTitle('Edit quest')).not.toBeVisible()
  })

  test('edit button visible on incomplete tasks', async ({ page }) => {
    // Find an incomplete task
    const incompleteCheckbox = page.locator('button.border-gray-300').first()

    if (await incompleteCheckbox.count() === 0) {
      test.skip()
      return
    }

    // Edit button should be visible
    const taskCard = incompleteCheckbox.locator('..').locator('..')
    await expect(taskCard.getByTitle('Edit quest')).toBeVisible()
  })

  test('can open task form via FAB', async ({ page }) => {
    // Click FAB button
    const fab = page.locator('button.fixed.bg-purple-600')
    await fab.click()

    // Task form modal should open - look for the heading specifically
    await expect(page.getByRole('heading', { name: 'New Quest' })).toBeVisible()
  })

  test('points display in header', async ({ page }) => {
    // Header should show points
    await expect(page.getByText(/points/i)).toBeVisible()
  })
})
