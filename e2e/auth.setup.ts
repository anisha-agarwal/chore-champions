import { test as setup, expect } from '@playwright/test'

const PARENT_AUTH_FILE = '.auth/parent.json'
const CHILD_AUTH_FILE = '.auth/child.json'

setup('authenticate as parent', async ({ page }) => {
  await page.goto('/login')

  await page.getByLabel(/email/i).fill(process.env.TEST_PARENT_EMAIL!)
  await page.getByLabel(/password/i).fill(process.env.TEST_PARENT_PASSWORD!)
  await page.getByRole('button', { name: /sign in/i }).click()

  // Wait for redirect to quests page
  await expect(page).toHaveURL('/quests', { timeout: 10000 })

  // Save auth state
  await page.context().storageState({ path: PARENT_AUTH_FILE })
})

setup('authenticate as child', async ({ page }) => {
  await page.goto('/login')

  await page.getByLabel(/email/i).fill(process.env.TEST_CHILD_EMAIL!)
  await page.getByLabel(/password/i).fill(process.env.TEST_CHILD_PASSWORD!)
  await page.getByRole('button', { name: /sign in/i }).click()

  // Wait for redirect to quests page
  await expect(page).toHaveURL('/quests', { timeout: 10000 })

  // Save auth state
  await page.context().storageState({ path: CHILD_AUTH_FILE })
})
