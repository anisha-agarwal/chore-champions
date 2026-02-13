/**
 * Playwright Demo Script
 *
 * Automates a walkthrough of the Chore Champions app for demos/screenshots.
 *
 * Usage:
 *   npx tsx scripts/playwright-demo.ts
 *   npx tsx scripts/playwright-demo.ts --headed    # Run with visible browser
 *   npx tsx scripts/playwright-demo.ts --slow      # Slow motion for recording
 */

import { chromium, Page } from 'playwright'
import * as path from 'path'
import * as fs from 'fs'
import dotenv from 'dotenv'

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const SCREENSHOT_DIR = path.join(__dirname, '../screenshots')

// Parse command line args
const args = process.argv.slice(2)
const headed = args.includes('--headed')
const slow = args.includes('--slow')

async function ensureScreenshotDir() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
  }
}

async function screenshot(page: Page, name: string) {
  const filepath = path.join(SCREENSHOT_DIR, `${name}.png`)
  await page.screenshot({ path: filepath, fullPage: true })
  console.log(`  Screenshot saved: ${filepath}`)
}

async function waitForLoad(page: Page) {
  // Wait for loading spinner to disappear
  const spinner = page.locator('.animate-spin')
  if (await spinner.isVisible({ timeout: 500 }).catch(() => false)) {
    await spinner.waitFor({ state: 'hidden', timeout: 10000 })
  }
  await page.waitForTimeout(slow ? 1000 : 300)
}

async function runDemo() {
  console.log('Starting Chore Champions Demo...\n')
  await ensureScreenshotDir()

  const browser = await chromium.launch({
    headless: !headed,
    slowMo: slow ? 500 : 0,
  })

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 14 Pro size
  })

  const page = await context.newPage()

  try {
    // 1. Landing Page
    console.log('1. Visiting landing page...')
    await page.goto(BASE_URL)
    await waitForLoad(page)
    await screenshot(page, '01-landing')

    // 2. Login Page
    console.log('2. Visiting login page...')
    await page.goto(`${BASE_URL}/login`)
    await waitForLoad(page)
    await screenshot(page, '02-login')

    // 3. Signup Page
    console.log('3. Visiting signup page...')
    await page.goto(`${BASE_URL}/signup`)
    await waitForLoad(page)
    await screenshot(page, '03-signup')

    // Check if we have test credentials for authenticated pages
    const email = process.env.TEST_PARENT_EMAIL
    const password = process.env.TEST_PARENT_PASSWORD

    if (email && password) {
      // 4. Login
      console.log('4. Logging in...')
      await page.goto(`${BASE_URL}/login`)
      await page.getByLabel(/email/i).fill(email)
      await page.getByLabel(/password/i).fill(password)
      await page.getByRole('button', { name: /sign in/i }).click()
      await page.waitForURL('**/quests', { timeout: 10000 })
      await waitForLoad(page)

      // 5. Quests Page
      console.log('5. Quests page...')
      await screenshot(page, '04-quests')

      // 6. Open New Quest Modal
      console.log('6. New quest modal...')
      await page.locator('button.fixed.bg-purple-600').click()
      await page.waitForSelector('text=New Quest')
      await screenshot(page, '05-new-quest-modal')
      await page.keyboard.press('Escape')

      // 7. Family Page
      console.log('7. Family page...')
      await page.goto(`${BASE_URL}/family`)
      await waitForLoad(page)
      await screenshot(page, '06-family')

      // 8. Invite Modal
      console.log('8. Invite modal...')
      await page.getByRole('button', { name: 'Invite' }).click()
      await page.waitForSelector('.font-mono.text-2xl')
      await screenshot(page, '07-invite-modal')
      await page.getByRole('button', { name: 'Done' }).click()

      // 9. Remove Member Modal (if other members exist)
      const removeButton = page.getByTitle('Remove member').first()
      if (await removeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('9. Remove member modal...')
        await removeButton.click()
        await page.waitForSelector('text=Remove Family Member')
        await screenshot(page, '08-remove-member-modal')
        await page.getByRole('button', { name: 'Cancel' }).click()
      }

      // 10. Rewards Page
      console.log('10. Rewards page...')
      await page.goto(`${BASE_URL}/rewards`)
      await waitForLoad(page)
      await screenshot(page, '09-rewards')

      // 11. Me Page
      console.log('11. Profile page...')
      await page.goto(`${BASE_URL}/me`)
      await waitForLoad(page)
      await screenshot(page, '10-profile')
    } else {
      console.log('\nSkipping authenticated pages (no TEST_PARENT_EMAIL/PASSWORD set)')
    }

    console.log('\nDemo complete! Screenshots saved to:', SCREENSHOT_DIR)
  } catch (error) {
    console.error('Demo failed:', error)
    await screenshot(page, 'error')
    throw error
  } finally {
    await browser.close()
  }
}

runDemo().catch((error) => {
  console.error(error)
  process.exit(1)
})
