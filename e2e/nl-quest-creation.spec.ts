import { test, expect } from '@playwright/test'
import { createTestTask, cleanupTestTask } from './helpers'

let createdTaskNames: string[] = []

test.describe('Natural Language Quest Creation', () => {
  test.beforeEach(async ({ page }) => {
    createdTaskNames = []
    await page.goto('/quests')
  })

  test.afterEach(async ({ page }) => {
    for (const taskName of createdTaskNames) {
      await cleanupTestTask(page, taskName)
    }
  })

  test('NL input pre-fills form and parent can submit', async ({ page }) => {
    // Mock the parse-quest API
    await page.route('**/api/ai/parse-quest', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          prefill: {
            title: 'NL Test Make Bed',
            description: 'Make bed neatly every morning',
            points: 5,
            time_of_day: 'morning',
            recurring: 'daily',
            assigned_to: null,
          },
        }),
      })
    })

    const taskName = `NL Test Make Bed`
    createdTaskNames.push(taskName)

    // Open the New Quest modal
    const fab = page.locator('button.fixed.bg-purple-600')
    await fab.click()
    await expect(page.getByRole('heading', { name: 'New Quest' })).toBeVisible()

    // Fill in the NL input
    const nlInput = page.getByLabel('Describe the quest')
    await nlInput.fill('Daily quest to make bed, 5 points')

    // Click Fill button
    await page.getByRole('button', { name: 'Fill' }).click()

    // Wait for form to be pre-filled
    await expect(page.getByPlaceholder(/clean your room/i)).toHaveValue('NL Test Make Bed')
    await expect(page.getByText('Form pre-filled! Review and submit below.')).toBeVisible()

    // Submit the form
    await page.getByRole('button', { name: /create quest/i }).click()

    // Wait for modal to close and task to appear
    await expect(page.getByRole('heading', { name: 'New Quest' })).not.toBeVisible()
    await expect(page.getByText(taskName)).toBeVisible({ timeout: 5000 })
  })

  test('shows error when parse returns null prefill', async ({ page }) => {
    // Mock the parse-quest API to return null prefill
    await page.route('**/api/ai/parse-quest', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ prefill: null }),
      })
    })

    // Open the New Quest modal
    const fab = page.locator('button.fixed.bg-purple-600')
    await fab.click()
    await expect(page.getByRole('heading', { name: 'New Quest' })).toBeVisible()

    // Fill in the NL input
    const nlInput = page.getByLabel('Describe the quest')
    await nlInput.fill('something unclear')

    // Click Fill button
    await page.getByRole('button', { name: 'Fill' }).click()

    // Error message should appear
    await expect(page.getByText('Could not parse quest. Please fill the form manually.')).toBeVisible()
  })

  test('NL input is not shown in edit mode', async ({ page }) => {
    const taskName = `NL Edit Test ${Date.now()}`
    createdTaskNames.push(taskName)

    // Create a task first
    await createTestTask(page, taskName)

    // Open edit modal
    const taskCard = page.locator('.bg-white.rounded-xl').filter({ hasText: taskName })
    await taskCard.getByTitle('Edit quest').click()
    await expect(page.getByRole('heading', { name: 'Edit Quest' })).toBeVisible()

    // NL input should not be present
    await expect(page.getByLabel('Describe the quest')).not.toBeVisible()

    // Close the edit modal
    await page.getByRole('button', { name: 'Cancel' }).click()
  })

  test('Enter key triggers parse', async ({ page }) => {
    // Mock the parse-quest API
    await page.route('**/api/ai/parse-quest', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          prefill: {
            title: 'Enter Key Quest',
            description: '',
            points: 10,
            time_of_day: 'anytime',
            recurring: null,
            assigned_to: null,
          },
        }),
      })
    })

    // Open the New Quest modal
    const fab = page.locator('button.fixed.bg-purple-600')
    await fab.click()
    await expect(page.getByRole('heading', { name: 'New Quest' })).toBeVisible()

    // Fill in the NL input and press Enter
    const nlInput = page.getByLabel('Describe the quest')
    await nlInput.fill('Enter key test quest')
    await nlInput.press('Enter')

    // Wait for form to be pre-filled
    await expect(page.getByPlaceholder(/clean your room/i)).toHaveValue('Enter Key Quest')
    await expect(page.getByText('Form pre-filled! Review and submit below.')).toBeVisible()

    // Close without submitting
    await page.getByRole('button', { name: 'Cancel' }).click()
  })
})
