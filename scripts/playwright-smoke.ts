/**
 * Playwright Smoke Test Script
 *
 * Quick health check of all pages - verifies pages load without errors.
 *
 * Usage:
 *   npx tsx scripts/playwright-smoke.ts
 *   npx tsx scripts/playwright-smoke.ts --headed    # Run with visible browser
 */

import { chromium, Page } from 'playwright'
import * as path from 'path'
import dotenv from 'dotenv'

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

// Parse command line args
const args = process.argv.slice(2)
const headed = args.includes('--headed')

interface CheckResult {
  page: string
  url: string
  status: 'pass' | 'fail'
  error?: string
  loadTime: number
}

async function checkPage(
  page: Page,
  name: string,
  url: string,
  expectedText?: string | RegExp
): Promise<CheckResult> {
  const start = Date.now()

  try {
    const response = await page.goto(url, { waitUntil: 'networkidle' })
    const loadTime = Date.now() - start

    // Check response status
    if (!response || response.status() >= 400) {
      return {
        page: name,
        url,
        status: 'fail',
        error: `HTTP ${response?.status() || 'no response'}`,
        loadTime,
      }
    }

    // Wait for loading spinner to disappear
    const spinner = page.locator('.animate-spin')
    if (await spinner.isVisible({ timeout: 500 }).catch(() => false)) {
      await spinner.waitFor({ state: 'hidden', timeout: 10000 })
    }

    // Check for expected text if provided
    if (expectedText) {
      const locator = typeof expectedText === 'string'
        ? page.getByText(expectedText)
        : page.getByText(expectedText)

      await locator.waitFor({ state: 'visible', timeout: 5000 })
    }

    // Check for JavaScript errors
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    if (errors.length > 0) {
      return {
        page: name,
        url,
        status: 'fail',
        error: `JS errors: ${errors.join(', ')}`,
        loadTime,
      }
    }

    return { page: name, url, status: 'pass', loadTime }
  } catch (error) {
    return {
      page: name,
      url,
      status: 'fail',
      error: error instanceof Error ? error.message : String(error),
      loadTime: Date.now() - start,
    }
  }
}

async function runSmokeTest() {
  console.log('Chore Champions Smoke Test')
  console.log('==========================\n')
  console.log(`Base URL: ${BASE_URL}\n`)

  const browser = await chromium.launch({ headless: !headed })
  const context = await browser.newContext()
  const page = await context.newPage()

  const results: CheckResult[] = []

  // Public pages
  console.log('Checking public pages...')

  results.push(await checkPage(page, 'Landing', BASE_URL, /chore champions/i))
  results.push(await checkPage(page, 'Login', `${BASE_URL}/login`, /sign in/i))
  results.push(await checkPage(page, 'Signup', `${BASE_URL}/signup`, /create.*account/i))

  // Check if we have test credentials
  const email = process.env.TEST_PARENT_EMAIL
  const password = process.env.TEST_PARENT_PASSWORD

  if (email && password) {
    console.log('\nLogging in for authenticated pages...')

    await page.goto(`${BASE_URL}/login`)
    await page.getByLabel(/email/i).fill(email)
    await page.getByLabel(/password/i).fill(password)
    await page.getByRole('button', { name: /sign in/i }).click()

    try {
      await page.waitForURL('**/quests', { timeout: 10000 })
      console.log('Login successful!\n')

      console.log('Checking authenticated pages...')
      results.push(await checkPage(page, 'Quests', `${BASE_URL}/quests`))
      results.push(await checkPage(page, 'Family', `${BASE_URL}/family`))
      results.push(await checkPage(page, 'Rewards', `${BASE_URL}/rewards`))
      results.push(await checkPage(page, 'Profile', `${BASE_URL}/me`))

      // Test invite code flow (case-insensitive)
      console.log('\nChecking invite code flow...')
      await page.goto(`${BASE_URL}/family`)
      await page.getByRole('button', { name: 'Invite' }).click()
      await page.waitForSelector('.font-mono.text-2xl', { timeout: 5000 })
      const inviteCode = await page.locator('.font-mono.text-2xl').textContent()

      if (inviteCode) {
        // Test uppercase
        results.push(await checkPage(page, 'Join (uppercase)', `${BASE_URL}/join/${inviteCode.toUpperCase()}`))
        // Test lowercase
        results.push(await checkPage(page, 'Join (lowercase)', `${BASE_URL}/join/${inviteCode.toLowerCase()}`))
      }
    } catch {
      console.log('Login failed - skipping authenticated pages\n')
    }
  } else {
    console.log('\nSkipping authenticated pages (no TEST_PARENT_EMAIL/PASSWORD)')
  }

  await browser.close()

  // Print results
  console.log('\n\nResults')
  console.log('-------')

  let passed = 0
  let failed = 0

  for (const result of results) {
    const icon = result.status === 'pass' ? '\u2713' : '\u2717'
    const time = `${result.loadTime}ms`

    if (result.status === 'pass') {
      console.log(`  ${icon} ${result.page} (${time})`)
      passed++
    } else {
      console.log(`  ${icon} ${result.page} - ${result.error}`)
      failed++
    }
  }

  console.log(`\nTotal: ${passed} passed, ${failed} failed`)

  if (failed > 0) {
    process.exit(1)
  }
}

runSmokeTest().catch((error) => {
  console.error('Smoke test failed:', error)
  process.exit(1)
})
