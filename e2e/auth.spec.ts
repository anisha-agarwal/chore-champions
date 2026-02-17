import { test, expect } from '@playwright/test'

test.describe('In-App Browser Banner', () => {
  test('shows warning banner when using in-app browser user agent', async ({ browser }) => {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) FBAN/FBIOS',
    })
    const page = await context.newPage()

    await page.goto('/login')
    await expect(page.getByText(/open in your browser/i)).toBeVisible()
    await context.close()
  })

  test('shows warning banner on signup page in in-app browser', async ({ browser }) => {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Linux; Android 13) WhatsApp/2.23',
    })
    const page = await context.newPage()

    await page.goto('/signup')
    await expect(page.getByText(/open in your browser/i)).toBeVisible()
    await context.close()
  })

  test('does not show banner in regular browser', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText(/open in your browser/i)).not.toBeVisible()
  })
})

test.describe('Login Page', () => {
  test('displays login form', async ({ page }) => {
    await page.goto('/login')

    await expect(page.getByRole('heading', { name: /chore champions/i })).toBeVisible()
    await expect(page.getByText(/welcome back/i)).toBeVisible()
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
  })

  test('displays Google and Facebook login buttons', async ({ page }) => {
    await page.goto('/login')

    await expect(page.getByText(/or continue with/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /google/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /facebook/i })).toBeVisible()
  })

  test('has link to signup', async ({ page }) => {
    await page.goto('/login')

    const signupLink = page.getByRole('link', { name: /sign up/i })
    await expect(signupLink).toBeVisible()

    await signupLink.click()
    await expect(page).toHaveURL('/signup')
  })

  test('shows error with invalid credentials', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel(/email/i).fill('invalid@test.com')
    await page.getByLabel(/password/i).fill('wrongpassword')
    await page.getByRole('button', { name: /sign in/i }).click()

    // Should show an error message
    await expect(page.getByText(/invalid|error|incorrect/i)).toBeVisible({ timeout: 10000 })
  })

  test('login with valid credentials redirects to /quests', async ({ page }) => {
    await page.goto('/login')

    // Use the test parent credentials
    const email = process.env.TEST_PARENT_EMAIL || 'e2e-parent@chore-champions-test.local'
    const password = process.env.TEST_PARENT_PASSWORD || 'TestPassword123!'

    await page.getByLabel(/email/i).fill(email)
    await page.getByLabel(/password/i).fill(password)
    await page.getByRole('button', { name: /sign in/i }).click()

    // Should redirect to quests page after login
    await expect(page).toHaveURL(/\/quests/, { timeout: 15000 })
    await expect(page.getByRole('heading', { name: 'Quests' })).toBeVisible()
  })
})

test.describe('Signup Page', () => {
  test('displays signup form with role selector', async ({ page }) => {
    await page.goto('/signup')

    await expect(page.getByRole('heading', { name: /chore champions/i })).toBeVisible()
    await expect(page.getByText(/join the family adventure/i)).toBeVisible()
    await expect(page.getByLabel(/display name/i)).toBeVisible()
    await expect(page.getByText('I am a...')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Parent' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Kid' })).toBeVisible()
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible()
  })

  test('role selector defaults to Kid', async ({ page }) => {
    await page.goto('/signup')

    const kidButton = page.getByRole('button', { name: 'Kid' })
    await expect(kidButton).toHaveClass(/bg-purple-600/)
  })

  test('can select Parent role', async ({ page }) => {
    await page.goto('/signup')

    const parentButton = page.getByRole('button', { name: 'Parent' })
    await parentButton.click()
    await expect(parentButton).toHaveClass(/bg-purple-600/)

    const kidButton = page.getByRole('button', { name: 'Kid' })
    await expect(kidButton).not.toHaveClass(/bg-purple-600/)
  })

  test('displays Google and Facebook signup buttons', async ({ page }) => {
    await page.goto('/signup')

    await expect(page.getByText(/or continue with/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /google/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /facebook/i })).toBeVisible()
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

  test('entering code navigates to join page with code', async ({ page }) => {
    await page.goto('/join')

    await page.getByLabel(/invite code/i).fill('testcode')
    await page.getByRole('button', { name: /continue/i }).click()

    // Should navigate to /join/TESTCODE (uppercase)
    await expect(page).toHaveURL('/join/TESTCODE')
  })

  test('invalid invite code shows error', async ({ page }) => {
    await page.goto('/join/INVALIDCODE123')

    // Should show invalid invite error
    await expect(page.getByRole('heading', { name: /invalid invite/i })).toBeVisible()
    await expect(page.getByText(/invalid or expired/i)).toBeVisible()
  })

  test('converts invite code to uppercase in input', async ({ page }) => {
    await page.goto('/join')

    const input = page.getByLabel(/invite code/i)
    await input.fill('abcd1234')

    // Input should show uppercase
    await expect(input).toHaveValue('ABCD1234')
  })
})

test.describe('Role Selector', () => {
  test('role selector works on signup page', async ({ page }) => {
    await page.goto('/signup')

    // Kid is selected by default
    const kidButton = page.getByRole('button', { name: 'Kid' })
    const parentButton = page.getByRole('button', { name: 'Parent' })

    await expect(kidButton).toHaveClass(/bg-purple-600/)
    await expect(parentButton).not.toHaveClass(/bg-purple-600/)

    // Click Parent
    await parentButton.click()

    await expect(parentButton).toHaveClass(/bg-purple-600/)
    await expect(kidButton).not.toHaveClass(/bg-purple-600/)

    // Click Kid again
    await kidButton.click()

    await expect(kidButton).toHaveClass(/bg-purple-600/)
    await expect(parentButton).not.toHaveClass(/bg-purple-600/)
  })
})
