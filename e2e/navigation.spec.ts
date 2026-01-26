import { test, expect } from '@playwright/test'

test.describe('Protected Routes', () => {
  test('redirects /quests to login when not authenticated', async ({ page }) => {
    await page.goto('/quests')

    // Should redirect to login
    await expect(page).toHaveURL('/login')
  })

  test('redirects /family to login when not authenticated', async ({ page }) => {
    await page.goto('/family')

    await expect(page).toHaveURL('/login')
  })

  test('redirects /rewards to login when not authenticated', async ({ page }) => {
    await page.goto('/rewards')

    await expect(page).toHaveURL('/login')
  })

  test('redirects /me to login when not authenticated', async ({ page }) => {
    await page.goto('/me')

    await expect(page).toHaveURL('/login')
  })
})

test.describe('Navigation Flow', () => {
  test('can navigate between auth pages', async ({ page }) => {
    // Start at landing
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /chore champions/i })).toBeVisible()

    // Go to signup
    await page.getByRole('link', { name: /get started free/i }).click()
    await expect(page).toHaveURL('/signup')

    // Go to login
    await page.getByRole('link', { name: /sign in/i }).click()
    await expect(page).toHaveURL('/login')

    // Go back to signup
    await page.getByRole('link', { name: /sign up/i }).click()
    await expect(page).toHaveURL('/signup')

    // Go to join
    await page.getByRole('link', { name: /join a family/i }).click()
    await expect(page).toHaveURL('/join')
  })
})
