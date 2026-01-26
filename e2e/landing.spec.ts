import { test, expect } from '@playwright/test'

test.describe('Landing Page', () => {
  test('displays hero section', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: /chore champions/i })).toBeVisible()
    await expect(page.getByText(/turn household tasks into epic quests/i)).toBeVisible()
  })

  test('has call-to-action buttons', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('link', { name: /get started free/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible()
  })

  test('displays feature cards', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByText(/create quests/i)).toBeVisible()
    await expect(page.getByText(/family fun/i)).toBeVisible()
    await expect(page.getByText(/earn rewards/i)).toBeVisible()
  })

  test('Get Started button navigates to signup', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('link', { name: /get started free/i }).click()

    await expect(page).toHaveURL('/signup')
  })

  test('Sign In button navigates to login', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('link', { name: /sign in/i }).click()

    await expect(page).toHaveURL('/login')
  })
})
