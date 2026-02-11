import { test, expect, Page } from '@playwright/test'

// Helper to create a test task via UI
async function createTestTask(page: Page, taskName: string, recurring?: 'daily' | 'weekly') {
  // Click FAB button to open form
  const fab = page.locator('button.fixed.bg-purple-600')
  await fab.click()

  // Wait for modal to open
  await expect(page.getByRole('heading', { name: 'New Quest' })).toBeVisible()

  // Fill in task name (using placeholder since label isn't associated)
  await page.getByPlaceholder(/clean your room/i).fill(taskName)

  // If recurring is specified, select it from the Repeat dropdown
  if (recurring) {
    const repeatSelect = page.locator('select').last()
    await repeatSelect.selectOption(recurring)
  }

  // Submit the form
  await page.getByRole('button', { name: /create quest/i }).click()

  // Wait for modal to close and task to appear
  await expect(page.getByRole('heading', { name: 'New Quest' })).not.toBeVisible()
  await expect(page.getByText(taskName)).toBeVisible({ timeout: 5000 })
}

// Helper to find and return a task card by name
function getTaskCard(page: Page, taskName: string) {
  return page.locator('.bg-white.rounded-xl').filter({ hasText: taskName })
}

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
    const taskName = `Test Complete Undo ${Date.now()}`

    // Create a test task
    await createTestTask(page, taskName)

    // Find the checkbox for our new task (should be incomplete)
    const taskCard = getTaskCard(page, taskName)
    const checkbox = taskCard.locator('button.border-gray-300')

    // Complete the task
    await checkbox.click()

    // Wait for completion - checkbox should turn green
    await expect(taskCard.locator('button.bg-green-500')).toBeVisible({ timeout: 5000 })

    // Hover should show "Click to undo" title
    const completedCheckbox = taskCard.locator('button.bg-green-500')
    await expect(completedCheckbox).toHaveAttribute('title', 'Click to undo')

    // Undo the completion
    await completedCheckbox.click()

    // Verify returned to incomplete state
    await expect(taskCard.locator('button.border-gray-300')).toBeVisible({ timeout: 5000 })
  })

  test('completed task shows strikethrough text', async ({ page }) => {
    const taskName = `Test Strikethrough ${Date.now()}`

    // Create a test task
    await createTestTask(page, taskName)

    // Find and complete the task
    const taskCard = getTaskCard(page, taskName)
    const checkbox = taskCard.locator('button.border-gray-300')
    await checkbox.click()

    // Wait for completion
    await expect(taskCard.locator('button.bg-green-500')).toBeVisible({ timeout: 5000 })

    // The task title should have line-through
    await expect(taskCard.locator('h3')).toHaveClass(/line-through/)

    // Cleanup: undo completion
    await taskCard.locator('button.bg-green-500').click()
    await expect(taskCard.locator('button.border-gray-300')).toBeVisible({ timeout: 5000 })
  })

  test('edit button hidden on completed tasks', async ({ page }) => {
    const taskName = `Test Edit Hidden ${Date.now()}`

    // Create a test task
    await createTestTask(page, taskName)

    // Find and complete the task
    const taskCard = getTaskCard(page, taskName)
    const checkbox = taskCard.locator('button.border-gray-300')
    await checkbox.click()

    // Wait for completion
    await expect(taskCard.locator('button.bg-green-500')).toBeVisible({ timeout: 5000 })

    // Edit button should not be visible for completed tasks
    await expect(taskCard.getByTitle('Edit quest')).not.toBeVisible()

    // Cleanup: undo completion
    await taskCard.locator('button.bg-green-500').click()
    await expect(taskCard.locator('button.border-gray-300')).toBeVisible({ timeout: 5000 })
  })

  test('edit button visible on incomplete tasks', async ({ page }) => {
    const taskName = `Test Edit Visible ${Date.now()}`

    // Create a test task
    await createTestTask(page, taskName)

    // Find the task card
    const taskCard = getTaskCard(page, taskName)

    // Edit button should be visible
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

  test('delete task flow', async ({ page }) => {
    const taskName = `Test Delete Task ${Date.now()}`

    // Create a test task
    await createTestTask(page, taskName)

    // Find the task card
    const taskCard = getTaskCard(page, taskName)
    await expect(taskCard).toBeVisible()

    // Click the delete button
    await taskCard.getByTitle('Delete quest').click()

    // Confirmation modal should appear
    await expect(page.getByRole('heading', { name: 'Delete Quest?' })).toBeVisible()
    await expect(page.getByText(taskName, { exact: false })).toBeVisible()

    // Click the Delete button in the modal
    await page.getByRole('button', { name: 'Delete' }).click()

    // Modal should close and task should be removed
    await expect(page.getByRole('heading', { name: 'Delete Quest?' })).not.toBeVisible()
    await expect(page.getByText(taskName)).not.toBeVisible({ timeout: 5000 })
  })

  test('cancel delete does not remove task', async ({ page }) => {
    const taskName = `Test Cancel Delete ${Date.now()}`

    // Create a test task
    await createTestTask(page, taskName)

    // Find the task card
    const taskCard = getTaskCard(page, taskName)
    await expect(taskCard).toBeVisible()

    // Click the delete button
    await taskCard.getByTitle('Delete quest').click()

    // Confirmation modal should appear
    await expect(page.getByRole('heading', { name: 'Delete Quest?' })).toBeVisible()

    // Click Cancel
    await page.getByRole('button', { name: 'Cancel' }).click()

    // Modal should close and task should still exist
    await expect(page.getByRole('heading', { name: 'Delete Quest?' })).not.toBeVisible()
    await expect(page.getByText(taskName)).toBeVisible()
  })

  test('recurring task shows skip and stop options', async ({ page }) => {
    const taskName = `Test Recurring Options ${Date.now()}`

    // Create a recurring task
    await createTestTask(page, taskName, 'daily')

    // Find the task card
    const taskCard = getTaskCard(page, taskName)
    await expect(taskCard).toBeVisible()

    // Should show "Daily" badge
    await expect(taskCard.getByText('Daily')).toBeVisible()

    // Click the delete button
    await taskCard.getByTitle('Delete quest').click()

    // Modal should show recurring options
    await expect(page.getByRole('heading', { name: 'Remove Quest?' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Skip today only' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Stop all future occurrences' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible()

    // Cancel to close modal
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('heading', { name: 'Remove Quest?' })).not.toBeVisible()
  })

  test('skip today hides recurring task for today only', async ({ page }) => {
    const taskName = `Test Skip Today ${Date.now()}`

    // Create a recurring task
    await createTestTask(page, taskName, 'daily')

    // Find the task card
    const taskCard = getTaskCard(page, taskName)
    await expect(taskCard).toBeVisible()

    // Click delete and skip today
    await taskCard.getByTitle('Delete quest').click()
    await expect(page.getByRole('heading', { name: 'Remove Quest?' })).toBeVisible()
    await page.getByRole('button', { name: 'Skip today only' }).click()

    // Modal should close and task should be hidden
    await expect(page.getByRole('heading', { name: 'Remove Quest?' })).not.toBeVisible()
    await expect(page.getByText(taskName)).not.toBeVisible({ timeout: 5000 })
  })

  test('stop future removes recurring task', async ({ page }) => {
    const taskName = `Test Stop Future ${Date.now()}`

    // Create a recurring task
    await createTestTask(page, taskName, 'daily')

    // Find the task card
    const taskCard = getTaskCard(page, taskName)
    await expect(taskCard).toBeVisible()

    // Click delete and stop all future
    await taskCard.getByTitle('Delete quest').click()
    await expect(page.getByRole('heading', { name: 'Remove Quest?' })).toBeVisible()
    await page.getByRole('button', { name: 'Stop all future occurrences' }).click()

    // Modal should close and task should be removed
    await expect(page.getByRole('heading', { name: 'Remove Quest?' })).not.toBeVisible()
    await expect(page.getByText(taskName)).not.toBeVisible({ timeout: 5000 })
  })
})
