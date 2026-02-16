import { Page, expect } from '@playwright/test'

interface CreateTestTaskOptions {
  recurring?: 'daily' | 'weekly'
  assignTo?: string  // Family member name to assign to (selects first match)
}

/**
 * Creates a test task via the UI
 */
export async function createTestTask(
  page: Page,
  taskName: string,
  optionsOrRecurring?: CreateTestTaskOptions | 'daily' | 'weekly'
) {
  // Handle backwards compatibility: string means recurring
  const options: CreateTestTaskOptions = typeof optionsOrRecurring === 'string'
    ? { recurring: optionsOrRecurring }
    : optionsOrRecurring || {}

  // Click FAB button to open form
  const fab = page.locator('button.fixed.bg-purple-600')
  await fab.click()

  // Wait for modal to open
  await expect(page.getByRole('heading', { name: 'New Quest' })).toBeVisible()

  // Fill in task name (using placeholder since label isn't associated)
  await page.getByPlaceholder(/clean your room/i).fill(taskName)

  // If assignTo is specified, select from the "Assign To" dropdown
  if (options.assignTo) {
    const assignSelect = page.locator('select').nth(2) // Third select is "Assign To"
    await assignSelect.selectOption({ label: options.assignTo })
  }

  // If recurring is specified, select it from the Repeat dropdown
  if (options.recurring) {
    const repeatSelect = page.locator('select').last()
    await repeatSelect.selectOption(options.recurring)
  }

  // Submit the form
  await page.getByRole('button', { name: /create quest/i }).click()

  // Wait for modal to close and task to appear
  await expect(page.getByRole('heading', { name: 'New Quest' })).not.toBeVisible()
  await expect(page.getByText(taskName)).toBeVisible({ timeout: 5000 })
}

/**
 * Finds and returns a task card element by task name
 */
export function getTaskCard(page: Page, taskName: string) {
  return page.locator('.bg-white.rounded-xl').filter({ hasText: taskName })
}

/**
 * Completes a task by clicking its checkbox
 */
export async function completeTask(page: Page, taskName: string) {
  const taskCard = getTaskCard(page, taskName)
  const checkbox = taskCard.locator('button.border-gray-300')
  await checkbox.click()
  await expect(taskCard.locator('button.bg-green-500')).toBeVisible({ timeout: 5000 })
}

/**
 * Uncompletes a task by clicking its completed checkbox
 */
export async function uncompleteTask(page: Page, taskName: string) {
  const taskCard = getTaskCard(page, taskName)
  const completedCheckbox = taskCard.locator('button.bg-green-500')
  await completedCheckbox.click()
  await expect(taskCard.locator('button.border-gray-300')).toBeVisible({ timeout: 5000 })
}

/**
 * Deletes a task via the UI (non-recurring)
 */
export async function deleteTask(page: Page, taskName: string) {
  const taskCard = getTaskCard(page, taskName)
  await taskCard.getByTitle('Delete quest').click()
  await expect(page.getByRole('heading', { name: 'Delete Quest?' })).toBeVisible()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Delete Quest?' })).not.toBeVisible()
  await expect(page.getByText(taskName)).not.toBeVisible({ timeout: 5000 })
}

/**
 * Skips a recurring task for today only
 */
export async function skipTaskToday(page: Page, taskName: string) {
  const taskCard = getTaskCard(page, taskName)
  await taskCard.getByTitle('Delete quest').click()
  await expect(page.getByRole('heading', { name: 'Remove Quest?' })).toBeVisible()
  await page.getByRole('button', { name: 'Skip today only' }).click()
  await expect(page.getByRole('heading', { name: 'Remove Quest?' })).not.toBeVisible()
  await expect(page.getByText(taskName)).not.toBeVisible({ timeout: 5000 })
}

/**
 * Stops all future occurrences of a recurring task
 */
export async function stopRecurringTask(page: Page, taskName: string) {
  const taskCard = getTaskCard(page, taskName)
  await taskCard.getByTitle('Delete quest').click()
  await expect(page.getByRole('heading', { name: 'Remove Quest?' })).toBeVisible()
  await page.getByRole('button', { name: 'Stop all future occurrences' }).click()
  await expect(page.getByRole('heading', { name: 'Remove Quest?' })).not.toBeVisible()
  await expect(page.getByText(taskName)).not.toBeVisible({ timeout: 5000 })
}

/**
 * Edits a task's title via the UI
 */
export async function editTask(page: Page, taskName: string, newTitle: string) {
  const taskCard = getTaskCard(page, taskName)
  await taskCard.getByTitle('Edit quest').click()

  // Wait for edit modal to open
  await expect(page.getByRole('heading', { name: 'Edit Quest' })).toBeVisible()

  // Clear and fill new title
  const titleInput = page.getByPlaceholder(/clean your room/i)
  await titleInput.clear()
  await titleInput.fill(newTitle)

  // Save changes
  await page.getByRole('button', { name: /save changes/i }).click()

  // Wait for modal to close and new title to appear
  await expect(page.getByRole('heading', { name: 'Edit Quest' })).not.toBeVisible()
  await expect(page.getByText(newTitle)).toBeVisible({ timeout: 5000 })
}

/**
 * Navigates to a page and waits for it to load
 */
export async function navigateTo(page: Page, path: string) {
  await page.goto(path)
  // Wait for loading spinner to disappear if present
  const spinner = page.locator('.animate-spin')
  if (await spinner.isVisible({ timeout: 500 }).catch(() => false)) {
    await expect(spinner).not.toBeVisible({ timeout: 10000 })
  }
}

/**
 * Gets the current user's points from the header
 */
export async function getUserPoints(page: Page): Promise<number> {
  const pointsText = await page.locator('.text-purple-600').first().textContent()
  return parseInt(pointsText || '0', 10)
}

/**
 * Waits for page to finish loading (no spinners)
 */
export async function waitForPageLoad(page: Page) {
  const spinner = page.locator('.animate-spin')
  await expect(spinner).not.toBeVisible({ timeout: 10000 })
}

/**
 * Test cleanup tracker - tracks created test data for cleanup
 */
export class TestCleanup {
  private taskNames: string[] = []

  /** Track a task name for later cleanup */
  trackTask(taskName: string) {
    this.taskNames.push(taskName)
  }

  /** Get all tracked task names */
  getTrackedTasks(): string[] {
    return [...this.taskNames]
  }

  /** Clear tracked tasks (call after cleanup) */
  clear() {
    this.taskNames = []
  }
}

/**
 * Cleans up a test task by deleting it (handles both recurring and non-recurring)
 * Silently succeeds if task doesn't exist
 */
export async function cleanupTestTask(page: Page, taskName: string) {
  // Close any open modals first by clicking the backdrop
  const backdrop = page.locator('.fixed.inset-0.bg-black\\/50.z-40')
  if (await backdrop.isVisible({ timeout: 500 }).catch(() => false)) {
    await backdrop.click({ force: true })
    await expect(backdrop).not.toBeVisible({ timeout: 3000 }).catch(() => {})
  }

  // Make sure we're on the quests page
  if (!page.url().includes('/quests')) {
    await page.goto('/quests')
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 10000 })
  }

  const taskCard = getTaskCard(page, taskName)

  // Check if task exists
  if (!(await taskCard.isVisible({ timeout: 1000 }).catch(() => false))) {
    return // Task doesn't exist, nothing to clean up
  }

  // Check if we can delete (button visible)
  const deleteButton = taskCard.getByTitle('Delete quest')
  if (!(await deleteButton.isVisible({ timeout: 500 }).catch(() => false))) {
    return // Can't delete this task (permissions)
  }

  await deleteButton.click()

  // Handle recurring vs non-recurring
  const recurringModal = page.getByRole('heading', { name: 'Remove Quest?' })
  const deleteModal = page.getByRole('heading', { name: 'Delete Quest?' })

  if (await recurringModal.isVisible({ timeout: 1000 }).catch(() => false)) {
    // Recurring task - stop all future occurrences
    await page.getByRole('button', { name: 'Stop all future occurrences' }).click()
  } else if (await deleteModal.isVisible({ timeout: 1000 }).catch(() => false)) {
    // Non-recurring task - confirm delete
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
  }

  // Wait for modal to close
  await expect(recurringModal).not.toBeVisible({ timeout: 5000 }).catch(() => {})
  await expect(deleteModal).not.toBeVisible({ timeout: 5000 }).catch(() => {})
}

/**
 * Cleans up all tracked tasks
 */
export async function cleanupAllTasks(page: Page, cleanup: TestCleanup) {
  const tasks = cleanup.getTrackedTasks()
  for (const taskName of tasks) {
    await cleanupTestTask(page, taskName)
  }
  cleanup.clear()
}
