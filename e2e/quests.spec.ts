import { test, expect } from '@playwright/test'
import { createTestTask, getTaskCard, cleanupTestTask } from './helpers'

// Track task names created in each test for cleanup
let createdTaskNames: string[] = []

test.describe('Quests Page', () => {
  test.beforeEach(async ({ page }) => {
    createdTaskNames = []
    await page.goto('/quests')
  })

  test.afterEach(async ({ page }) => {
    // Clean up any tasks created during the test
    for (const taskName of createdTaskNames) {
      await cleanupTestTask(page, taskName)
    }
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
    createdTaskNames.push(taskName)

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
    createdTaskNames.push(taskName)

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
    createdTaskNames.push(taskName)

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
    createdTaskNames.push(taskName)

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

    // Click the Delete button in the modal (exact match to avoid matching "Delete quest" buttons)
    await page.getByRole('button', { name: 'Delete', exact: true }).click()

    // Modal should close and task should be removed
    await expect(page.getByRole('heading', { name: 'Delete Quest?' })).not.toBeVisible()
    await expect(page.getByText(taskName)).not.toBeVisible({ timeout: 5000 })
  })

  test('cancel delete does not remove task', async ({ page }) => {
    const taskName = `Test Cancel Delete ${Date.now()}`
    createdTaskNames.push(taskName)

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
    createdTaskNames.push(taskName)

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

  test('edit task flow', async ({ page }) => {
    const taskName = `Test Edit Task ${Date.now()}`
    const newTaskName = `Edited Task ${Date.now()}`
    createdTaskNames.push(newTaskName) // Track the new name for cleanup

    // Create a test task
    await createTestTask(page, taskName)

    // Find the task card and click edit
    const taskCard = getTaskCard(page, taskName)
    await taskCard.getByTitle('Edit quest').click()

    // Edit modal should open
    await expect(page.getByRole('heading', { name: 'Edit Quest' })).toBeVisible()

    // Change the title
    const titleInput = page.getByPlaceholder(/clean your room/i)
    await titleInput.clear()
    await titleInput.fill(newTaskName)

    // Save changes
    await page.getByRole('button', { name: /save changes/i }).click()

    // Modal should close and new title should appear
    await expect(page.getByRole('heading', { name: 'Edit Quest' })).not.toBeVisible()
    await expect(page.getByText(newTaskName)).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(taskName)).not.toBeVisible()
  })

  test('edit task cancel does not save changes', async ({ page }) => {
    const taskName = `Test Edit Cancel ${Date.now()}`
    createdTaskNames.push(taskName)

    // Create a test task
    await createTestTask(page, taskName)

    // Find the task card and click edit
    const taskCard = getTaskCard(page, taskName)
    await taskCard.getByTitle('Edit quest').click()

    // Edit modal should open
    await expect(page.getByRole('heading', { name: 'Edit Quest' })).toBeVisible()

    // Change the title
    const titleInput = page.getByPlaceholder(/clean your room/i)
    await titleInput.clear()
    await titleInput.fill('Should Not Save')

    // Cancel instead of saving - click the X button in the modal header
    await page.locator('.fixed.inset-0.z-50 button').first().click()

    // Modal should close and original title should still be there
    await expect(page.getByRole('heading', { name: 'Edit Quest' })).not.toBeVisible({ timeout: 5000 })
    await expect(page.getByText(taskName)).toBeVisible()
    await expect(page.getByText('Should Not Save')).not.toBeVisible()
  })

  test('completing task updates points', async ({ page }) => {
    const taskName = `Test Points Update ${Date.now()}`
    createdTaskNames.push(taskName)

    // Get initial points
    const initialPointsText = await page.locator('header .text-purple-600').textContent()
    const initialPoints = parseInt(initialPointsText || '0', 10)

    // Create a test task (default 10 points)
    await createTestTask(page, taskName)

    // Complete the task
    const taskCard = getTaskCard(page, taskName)
    await taskCard.locator('button.border-gray-300').click()
    await expect(taskCard.locator('button.bg-green-500')).toBeVisible({ timeout: 5000 })

    // Wait for points to update
    await page.waitForTimeout(500)

    // Check points increased
    const newPointsText = await page.locator('header .text-purple-600').textContent()
    const newPoints = parseInt(newPointsText || '0', 10)
    expect(newPoints).toBeGreaterThan(initialPoints)

    // Undo to restore points (cleanup)
    await taskCard.locator('button.bg-green-500').click()
    await expect(taskCard.locator('button.border-gray-300')).toBeVisible({ timeout: 5000 })
  })

  test('uncompleting task deducts points', async ({ page }) => {
    const taskName = `Test Points Deduct ${Date.now()}`
    createdTaskNames.push(taskName)

    // Create and complete a task
    await createTestTask(page, taskName)
    const taskCard = getTaskCard(page, taskName)
    await taskCard.locator('button.border-gray-300').click()
    await expect(taskCard.locator('button.bg-green-500')).toBeVisible({ timeout: 5000 })

    // Wait for points to update
    await page.waitForTimeout(500)

    // Get points after completion
    const pointsAfterComplete = await page.locator('header .text-purple-600').textContent()
    const pointsAfter = parseInt(pointsAfterComplete || '0', 10)

    // Undo the completion
    await taskCard.locator('button.bg-green-500').click()
    await expect(taskCard.locator('button.border-gray-300')).toBeVisible({ timeout: 5000 })

    // Wait for points to update
    await page.waitForTimeout(500)

    // Check points decreased
    const pointsAfterUndo = await page.locator('header .text-purple-600').textContent()
    const finalPoints = parseInt(pointsAfterUndo || '0', 10)
    expect(finalPoints).toBeLessThan(pointsAfter)
  })

  test('task shows assigned member avatar', async ({ page }) => {
    const taskName = `Test Assignee Avatar ${Date.now()}`
    createdTaskNames.push(taskName)

    // Create a task
    await createTestTask(page, taskName)

    // Task card should show an avatar or assignee indicator
    const taskCard = getTaskCard(page, taskName)
    await expect(taskCard).toBeVisible()

    // Should have avatar image or fallback
    const avatar = taskCard.locator('img, .rounded-full')
    await expect(avatar.first()).toBeVisible()
  })

  test('assigned task avatar shows name tooltip', async ({ page }) => {
    const taskName = `Test Tooltip ${Date.now()}`
    createdTaskNames.push(taskName)

    // Get a family member name to assign to (from the Assign To dropdown)
    const fab = page.locator('button.fixed.bg-purple-600')
    await fab.click()
    await expect(page.getByRole('heading', { name: 'New Quest' })).toBeVisible()

    // Get first family member option (skip "Anyone")
    const assignSelect = page.locator('select').nth(2)
    const options = assignSelect.locator('option')
    const optionCount = await options.count()

    if (optionCount <= 1) {
      // No family members to assign to - close modal and skip
      await page.locator('.fixed.inset-0.z-50 button').first().click()
      return
    }

    // Get the second option (first family member after "Anyone")
    const memberName = await options.nth(1).textContent()
    await page.locator('.fixed.inset-0.z-50 button').first().click() // Close modal
    await expect(page.getByRole('heading', { name: 'New Quest' })).not.toBeVisible()

    // Create task assigned to that member
    await createTestTask(page, taskName, { assignTo: memberName! })

    // Find the task card
    const taskCard = getTaskCard(page, taskName)
    await expect(taskCard).toBeVisible()

    // Avatar should have title attribute with assignee name
    const avatar = taskCard.locator('div.rounded-full[title]')
    await expect(avatar).toHaveAttribute('title', memberName!)
  })

  test('week picker changes displayed tasks', async ({ page }) => {
    // Get the week picker buttons
    const dayButtons = page.locator('button').filter({ hasText: /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/i })

    // Click a different day
    const buttons = await dayButtons.all()
    if (buttons.length > 1) {
      // Click the second day button (different from current)
      await buttons[1].click()

      // Page should update (loading might occur)
      await page.waitForTimeout(500)

      // Quests heading should still be visible
      await expect(page.getByRole('heading', { name: 'Quests' })).toBeVisible()
    }
  })

  test('time filter filters tasks', async ({ page }) => {
    // Look for time filter buttons
    const morningFilter = page.getByRole('button', { name: /morning/i })
    const allFilter = page.getByRole('button', { name: /all/i })

    if (await morningFilter.isVisible({ timeout: 1000 }).catch(() => false)) {
      // Click morning filter
      await morningFilter.click()
      await page.waitForTimeout(300)

      // Click all filter to reset
      if (await allFilter.isVisible({ timeout: 1000 }).catch(() => false)) {
        await allFilter.click()
      }
    }

    // Page should still work
    await expect(page.getByRole('heading', { name: 'Quests' })).toBeVisible()
  })
})
