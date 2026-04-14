import { test, expect } from '@playwright/test'

test.describe('Push Notifications Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/push/preferences', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              user_id: 'test-user',
              push_enabled: true,
              types_enabled: { task_completed: true, streak_milestone: true, test: true },
              quiet_hours_start: null,
              quiet_hours_end: null,
              timezone: 'UTC',
              updated_at: new Date().toISOString(),
            },
          }),
        })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: {} }),
        })
      }
    })

    await page.goto('/me?tab=notifications')
    await page.getByTestId('notification-settings').waitFor()
  })

  test('renders the Alerts tab in the tab switcher', async ({ page }) => {
    const tab = page.getByRole('button', { name: 'Alerts' })
    await expect(tab).toBeVisible()
  })

  test('shows notification settings when tab is active', async ({ page }) => {
    await expect(page.getByTestId('notification-settings')).toBeVisible()
  })

  test('shows master push toggle', async ({ page }) => {
    const toggle = page.getByLabel('Enable push notifications')
    await expect(toggle).toBeVisible()
    await expect(toggle).toBeChecked()
  })

  test('parent sees task_completed type toggle', async ({ page }) => {
    await expect(page.getByLabel('Kid completes a task')).toBeVisible()
  })

  test('shows quiet hours selects', async ({ page }) => {
    await expect(page.getByLabel('Quiet hours start')).toBeVisible()
    await expect(page.getByLabel('Quiet hours end')).toBeVisible()
  })

  test('toggles master switch off and disables type toggles', async ({ page }) => {
    const master = page.getByLabel('Enable push notifications')
    await master.click({ force: true })
    await expect(master).not.toBeChecked()

    const streakToggle = page.getByLabel('Streak milestone reached')
    await expect(streakToggle).toBeDisabled()
  })

  test('navigates to notifications tab via direct URL', async ({ page }) => {
    await page.goto('/me?tab=notifications')
    await page.getByTestId('notification-settings').waitFor()
    await expect(page.getByTestId('notification-settings')).toBeVisible()
  })

  test('toggling a type checkbox updates its state', async ({ page }) => {
    const checkbox = page.getByLabel('Streak milestone reached')
    await expect(checkbox).toBeChecked()
    await checkbox.click()
    await expect(checkbox).not.toBeChecked()
  })

  test('changing quiet hours updates the select value', async ({ page }) => {
    const select = page.getByLabel('Quiet hours start')
    await select.selectOption('22')
    await expect(select).toHaveValue('22')
  })
})
