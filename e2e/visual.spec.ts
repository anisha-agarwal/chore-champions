/**
 * Visual Regression Tests
 *
 * Captures screenshots of key pages and compares to baselines.
 * Run with --update-snapshots to refresh baselines when UI changes are intentional.
 */

import { test, expect } from '@playwright/test'

test.describe('Visual regression - public pages', () => {
  test('landing page', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('landing.png', { maxDiffPixelRatio: 0.02 })
  })

  test('login page', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('login.png', { maxDiffPixelRatio: 0.02 })
  })

  test('signup page', async ({ page }) => {
    await page.goto('/signup')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('signup.png', { maxDiffPixelRatio: 0.02 })
  })
})

test.describe('Visual regression - authenticated pages', () => {
  test('quests page', async ({ page }) => {
    await page.goto('/quests')
    await page.waitForLoadState('networkidle')
    // Wait for loading spinner to clear
    const spinner = page.locator('.animate-spin')
    if (await spinner.isVisible({ timeout: 500 }).catch(() => false)) {
      await spinner.waitFor({ state: 'hidden', timeout: 10000 })
    }
    await expect(page).toHaveScreenshot('quests.png', { maxDiffPixelRatio: 0.05 })
  })

  test('family page', async ({ page }) => {
    await page.goto('/family')
    await page.waitForLoadState('networkidle')
    const spinner = page.locator('.animate-spin')
    if (await spinner.isVisible({ timeout: 500 }).catch(() => false)) {
      await spinner.waitFor({ state: 'hidden', timeout: 10000 })
    }
    await expect(page).toHaveScreenshot('family.png', { maxDiffPixelRatio: 0.05 })
  })

  test('rewards page', async ({ page }) => {
    await page.goto('/rewards')
    await page.waitForLoadState('networkidle')
    const spinner = page.locator('.animate-spin')
    if (await spinner.isVisible({ timeout: 500 }).catch(() => false)) {
      await spinner.waitFor({ state: 'hidden', timeout: 10000 })
    }
    await expect(page).toHaveScreenshot('rewards.png', { maxDiffPixelRatio: 0.05 })
  })

  test('profile page', async ({ page }) => {
    await page.goto('/me')
    await page.waitForLoadState('networkidle')
    const spinner = page.locator('.animate-spin')
    if (await spinner.isVisible({ timeout: 500 }).catch(() => false)) {
      await spinner.waitFor({ state: 'hidden', timeout: 10000 })
    }
    await expect(page).toHaveScreenshot('profile.png', { maxDiffPixelRatio: 0.05 })
  })
})
