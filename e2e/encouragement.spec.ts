import { test, expect } from '@playwright/test'
import { createTestTask, getTaskCard, cleanupTestTask, completeTask, uncompleteTask } from './helpers'

// All fallback messages from lib/encouragement.ts (points category is default for 10-pt tasks)
const ALL_FALLBACK_MESSAGES = [
  'Great job getting that done!',
  'You crushed it! Keep going!',
  'Another quest complete! You rock!',
  'Way to go, champion!',
  'Look at you go! Unstoppable!',
  'Nice! Those points are adding up!',
  'Your point stash is growing fast!',
  'Ka-ching! More points in the bank!',
  'Points earned! You are on a roll!',
  'Every point counts and you just scored!',
  'All quests done! You are a superstar!',
  'Everything finished! Time to celebrate!',
  'Clean sweep! Every quest complete!',
  'All done! You are a true champion!',
  'Mission accomplished! Every quest conquered!',
]

let createdTaskNames: string[] = []

test.describe('Encouragement Toasts', () => {
  test.beforeEach(async ({ page }) => {
    createdTaskNames = []
    await page.goto('/quests')
  })

  test.afterEach(async ({ page }) => {
    for (const taskName of createdTaskNames) {
      await cleanupTestTask(page, taskName)
    }
  })

  test('shows encouragement toast after completing a quest', async ({ page }) => {
    // Mock the encouragement API to return a specific message
    await page.route('**/api/ai/encouragement', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Amazing work, champion!', isMilestone: false }),
      })
    })

    const taskName = `Test Encouragement ${Date.now()}`
    createdTaskNames.push(taskName)

    await createTestTask(page, taskName)
    await completeTask(page, taskName)

    // Assert toast appears with the mocked message
    const toast = page.locator('[data-sonner-toast]').filter({ hasText: 'Amazing work, champion!' })
    await expect(toast).toBeVisible({ timeout: 5000 })

    // Undo completion for clean state
    await uncompleteTask(page, taskName)
  })

  test('shows milestone toast when all quests completed for the day', async ({ page }) => {
    // Mock the encouragement API to return a milestone message
    await page.route('**/api/ai/encouragement', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'All done for today!', isMilestone: true }),
      })
    })

    // Complete any existing incomplete tasks first to set up the "all-done" condition
    const incompleteTasks = page.locator('.bg-white.rounded-xl button.border-gray-300')
    const existingIncompleteCount = await incompleteTasks.count()
    const undoNames: string[] = []

    for (let i = 0; i < existingIncompleteCount; i++) {
      // Re-query since DOM changes after each click
      const checkbox = page.locator('.bg-white.rounded-xl button.border-gray-300').first()
      if (!(await checkbox.isVisible({ timeout: 1000 }).catch(() => false))) break
      const card = checkbox.locator('xpath=ancestor::div[contains(@class, "bg-white")]').first()
      const name = await card.locator('h3').textContent()
      await checkbox.click()
      await expect(checkbox).not.toBeVisible({ timeout: 5000 })
      if (name) undoNames.push(name.trim())
    }

    // Create one more task and complete it — triggers all-done milestone
    const taskName = `Test Milestone ${Date.now()}`
    createdTaskNames.push(taskName)
    await createTestTask(page, taskName)
    await completeTask(page, taskName)

    // Assert milestone toast appears (toast.success renders with success styling)
    const toast = page.locator('[data-sonner-toast]').filter({ hasText: 'All done for today!' })
    await expect(toast).toBeVisible({ timeout: 5000 })

    // Undo our task completion
    await uncompleteTask(page, taskName)

    // Undo previously completed tasks to restore original state
    for (const name of undoNames.reverse()) {
      await uncompleteTask(page, name).catch(() => {})
    }
  })

  test('shows fallback message when encouragement API fails', async ({ page }) => {
    // Mock the encouragement API to return an error
    await page.route('**/api/ai/encouragement', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      })
    })

    const taskName = `Test Fallback ${Date.now()}`
    createdTaskNames.push(taskName)

    await createTestTask(page, taskName)
    await completeTask(page, taskName)

    // Assert that a toast appears with one of the known fallback messages
    const toast = page.locator('[data-sonner-toast]')
    await expect(toast.first()).toBeVisible({ timeout: 5000 })

    const toastText = await toast.first().textContent()
    const matchesFallback = ALL_FALLBACK_MESSAGES.some((msg) => toastText?.includes(msg))
    expect(matchesFallback).toBe(true)

    // Undo completion for clean state
    await uncompleteTask(page, taskName)
  })
})
