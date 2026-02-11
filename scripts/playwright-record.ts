/**
 * Playwright Video Recording Script
 *
 * Records a video walkthrough of the Chore Champions app.
 *
 * Usage:
 *   npx tsx scripts/playwright-record.ts
 *   npx tsx scripts/playwright-record.ts --headed    # Watch while recording
 */

import { chromium, Page } from 'playwright'
import * as path from 'path'
import * as fs from 'fs'
import dotenv from 'dotenv'

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const VIDEO_DIR = path.join(__dirname, '../videos')

// Parse command line args
const args = process.argv.slice(2)
const headed = args.includes('--headed')

async function ensureVideoDir() {
  if (!fs.existsSync(VIDEO_DIR)) {
    fs.mkdirSync(VIDEO_DIR, { recursive: true })
  }
}

async function pause(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForLoad(page: Page) {
  const spinner = page.locator('.animate-spin')
  if (await spinner.isVisible({ timeout: 500 }).catch(() => false)) {
    await spinner.waitFor({ state: 'hidden', timeout: 10000 })
  }
  await pause(800) // Extra pause for video clarity
}

async function recordDemo() {
  console.log('Recording Chore Champions Demo Video...\n')
  await ensureVideoDir()

  const browser = await chromium.launch({
    headless: !headed,
  })

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 14 Pro size
    recordVideo: {
      dir: VIDEO_DIR,
      size: { width: 390, height: 844 },
    },
  })

  const page = await context.newPage()

  try {
    // 1. Landing Page
    console.log('1. Landing page...')
    await page.goto(BASE_URL)
    await waitForLoad(page)
    await pause(2000) // Hold on landing

    // 2. Login Page
    console.log('2. Login page...')
    await page.goto(`${BASE_URL}/login`)
    await waitForLoad(page)
    await pause(1500)

    // Check if we have test credentials
    const email = process.env.TEST_PARENT_EMAIL
    const password = process.env.TEST_PARENT_PASSWORD

    if (email && password) {
      // 3. Type credentials (slowly for video)
      console.log('3. Entering credentials...')
      await page.getByLabel(/email/i).click()
      await page.getByLabel(/email/i).type(email, { delay: 50 })
      await pause(500)
      await page.getByLabel(/password/i).click()
      await page.getByLabel(/password/i).type(password, { delay: 50 })
      await pause(1000)

      // 4. Click sign in
      console.log('4. Signing in...')
      await page.getByRole('button', { name: /sign in/i }).click()
      await page.waitForURL('**/quests', { timeout: 10000 })
      await waitForLoad(page)
      await pause(2000)

      // 5. Scroll through quests
      console.log('5. Browsing quests...')
      await page.mouse.wheel(0, 200)
      await pause(1000)
      await page.mouse.wheel(0, -200)
      await pause(1000)

      // 6. Open New Quest Modal
      console.log('6. Opening new quest form...')
      await page.locator('button.fixed.bg-purple-600').click()
      await page.waitForSelector('text=New Quest')
      await pause(2000)

      // 7. Fill out a quest (but don't submit)
      console.log('7. Filling quest form...')
      await page.getByPlaceholder(/clean your room/i).click()
      await page.getByPlaceholder(/clean your room/i).type('Water the plants', { delay: 80 })
      await pause(1500)

      // Close modal
      await page.keyboard.press('Escape')
      await pause(1000)

      // 8. Navigate to Family using bottom nav
      console.log('8. Family page...')
      await page.click('a[href="/family"]')
      await waitForLoad(page)
      await pause(2500)

      // Open invite modal if available
      const inviteButton = page.getByRole('button', { name: 'Invite' })
      if (await inviteButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log('   Opening invite modal...')
        await inviteButton.click()
        await pause(2000)
        await page.getByRole('button', { name: 'Done' }).click()
        await pause(1000)
      }

      // 9. Navigate to Rewards using bottom nav
      console.log('9. Rewards page...')
      await page.click('a[href="/rewards"]')
      await waitForLoad(page)
      await pause(2500)

      // Scroll to show full leaderboard
      await page.mouse.wheel(0, 300)
      await pause(1500)
      await page.mouse.wheel(0, -300)
      await pause(1000)

      // 10. Navigate to Profile using bottom nav
      console.log('10. Profile page...')
      await page.click('a[href="/me"]')
      await waitForLoad(page)
      await pause(2500)

      // Final pause
      await pause(1000)
    } else {
      console.log('\nNo credentials - recording unauthenticated pages only')
      await pause(2000)
    }

    console.log('\nClosing browser and saving video...')
  } catch (error) {
    console.error('Recording failed:', error)
    throw error
  } finally {
    await page.close() // This triggers video save
    await context.close()
    await browser.close()
  }

  // Find the video file
  const files = fs.readdirSync(VIDEO_DIR)
  const videoFile = files.find((f) => f.endsWith('.webm'))

  if (videoFile) {
    const videoPath = path.join(VIDEO_DIR, videoFile)
    const newPath = path.join(VIDEO_DIR, `demo-${Date.now()}.webm`)
    fs.renameSync(videoPath, newPath)
    console.log(`\nVideo saved: ${newPath}`)
    console.log('\nTip: Convert to MP4 with:')
    console.log(`  ffmpeg -i "${newPath}" -c:v libx264 "${newPath.replace('.webm', '.mp4')}"`)
  }
}

recordDemo().catch((error) => {
  console.error(error)
  process.exit(1)
})
