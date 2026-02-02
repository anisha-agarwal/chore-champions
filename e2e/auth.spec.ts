import { test, expect } from '@playwright/test'

test.describe('Login Page', () => {
  test('displays login form', async ({ page }) => {
    await page.goto('/login')

    await expect(page.getByRole('heading', { name: /chore champions/i })).toBeVisible()
    await expect(page.getByText(/welcome back/i)).toBeVisible()
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
  })

  test('displays Google login button', async ({ page }) => {
    await page.goto('/login')

    await expect(page.getByText(/or continue with/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /google/i })).toBeVisible()
  })

  test('has link to signup', async ({ page }) => {
    await page.goto('/login')

    const signupLink = page.getByRole('link', { name: /sign up/i })
    await expect(signupLink).toBeVisible()

    await signupLink.click()
    await expect(page).toHaveURL('/signup')
  })

  // Skip in CI - requires real Supabase connection to test auth errors
  test.skip('shows error with invalid credentials', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel(/email/i).fill('invalid@test.com')
    await page.getByLabel(/password/i).fill('wrongpassword')
    await page.getByRole('button', { name: /sign in/i }).click()

    // Should show an error message
    await expect(page.getByText(/invalid|error|incorrect/i)).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Signup Page', () => {
  test('displays signup form', async ({ page }) => {
    await page.goto('/signup')

    await expect(page.getByRole('heading', { name: /chore champions/i })).toBeVisible()
    await expect(page.getByText(/join the family adventure/i)).toBeVisible()
    await expect(page.getByLabel(/display name/i)).toBeVisible()
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible()
  })

  test('displays Google signup button', async ({ page }) => {
    await page.goto('/signup')

    await expect(page.getByText(/or continue with/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /google/i })).toBeVisible()
  })

  test('has link to login', async ({ page }) => {
    await page.goto('/signup')

    const loginLink = page.getByRole('link', { name: /sign in/i })
    await expect(loginLink).toBeVisible()

    await loginLink.click()
    await expect(page).toHaveURL('/login')
  })

  test('has link to join family', async ({ page }) => {
    await page.goto('/signup')

    const joinLink = page.getByRole('link', { name: /join a family/i })
    await expect(joinLink).toBeVisible()

    await joinLink.click()
    await expect(page).toHaveURL('/join')
  })

  test('validates required fields', async ({ page }) => {
    await page.goto('/signup')

    // Try to submit empty form
    await page.getByRole('button', { name: /create account/i }).click()

    // Form should not submit - still on signup page
    await expect(page).toHaveURL('/signup')
  })
})

test.describe('Join Family Page', () => {
  test('displays invite code input', async ({ page }) => {
    await page.goto('/join')

    await expect(page.getByRole('heading', { name: /join a family/i })).toBeVisible()
    await expect(page.getByLabel(/invite code/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /continue/i })).toBeVisible()
  })

  test('has links to signup and login', async ({ page }) => {
    await page.goto('/join')

    await expect(page.getByRole('link', { name: /create a new family/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible()
  })
})
