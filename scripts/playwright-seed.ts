/**
 * Playwright Data Seeding Script
 *
 * Creates sample tasks via the UI for testing/demo purposes.
 *
 * Usage:
 *   npx tsx scripts/playwright-seed.ts
 *   npx tsx scripts/playwright-seed.ts --headed    # Run with visible browser
 *   npx tsx scripts/playwright-seed.ts --cleanup   # Delete seeded tasks instead
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
const cleanup = args.includes('--cleanup')

// Sample tasks to seed
const SAMPLE_TASKS = [
  { title: 'Make your bed', recurring: 'daily', time: 'morning' },
  { title: 'Brush teeth', recurring: 'daily', time: 'morning' },
  { title: 'Put away toys', recurring: 'daily', time: 'evening' },
  { title: 'Set the table', recurring: 'daily', time: 'evening' },
  { title: 'Feed the pet', recurring: 'daily', time: 'morning' },
  { title: 'Take out trash', recurring: 'weekly', time: 'evening' },
  { title: 'Clean your room', recurring: 'weekly', time: 'afternoon' },
  { title: 'Help with laundry', recurring: 'weekly', time: 'afternoon' },
]

// Prefix for seeded tasks (makes cleanup easier)
const SEED_PREFIX = '[Seed] '

async function login(page: Page) {
  const email = process.env.TEST_PARENT_EMAIL
  const password = process.env.TEST_PARENT_PASSWORD

  if (!email || !password) {
    throw new Error('TEST_PARENT_EMAIL and TEST_PARENT_PASSWORD must be set')
  }

  await page.goto(`${BASE_URL}/login`)
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL('**/quests', { timeout: 10000 })

  // Wait for page to load
  const spinner = page.locator('.animate-spin')
  if (await spinner.isVisible({ timeout: 500 }).catch(() => false)) {
    await spinner.waitFor({ state: 'hidden', timeout: 10000 })
  }
}

async function createTask(
  page: Page,
  title: string,
  recurring?: 'daily' | 'weekly',
  timeOfDay?: string
) {
  // Click FAB to open form
  await page.locator('button.fixed.bg-purple-600').click()
  await page.waitForSelector('text=New Quest')

  // Fill title
  await page.getByPlaceholder(/clean your room/i).fill(SEED_PREFIX + title)

  // Set recurring if specified
  if (recurring) {
    const repeatSelect = page.locator('select').last()
    await repeatSelect.selectOption(recurring)
  }

  // Set time of day if specified
  if (timeOfDay) {
    const timeSelect = page.locator('select').first()
    await timeSelect.selectOption(timeOfDay)
  }

  // Submit
  await page.getByRole('button', { name: /create quest/i }).click()

  // Wait for modal to close
  await page.waitForSelector('text=New Quest', { state: 'hidden' })
  await page.waitForTimeout(300)
}

async function deleteTask(page: Page, title: string) {
  const taskCard = page.locator('.bg-white.rounded-xl').filter({ hasText: title })

  if (!(await taskCard.isVisible({ timeout: 1000 }).catch(() => false))) {
    return false // Task not found
  }

  const deleteButton = taskCard.getByTitle('Delete quest')
  if (!(await deleteButton.isVisible({ timeout: 500 }).catch(() => false))) {
    return false // Can't delete
  }

  await deleteButton.click()

  // Handle modal
  const recurringModal = page.getByRole('heading', { name: 'Remove Quest?' })
  const deleteModal = page.getByRole('heading', { name: 'Delete Quest?' })

  if (await recurringModal.isVisible({ timeout: 1000 }).catch(() => false)) {
    await page.getByRole('button', { name: 'Stop all future occurrences' }).click()
  } else if (await deleteModal.isVisible({ timeout: 1000 }).catch(() => false)) {
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
  }

  await page.waitForTimeout(300)
  return true
}

async function seedTasks() {
  console.log('Seeding sample tasks...\n')

  const browser = await chromium.launch({ headless: !headed })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    await login(page)
    console.log('Logged in successfully\n')

    for (const task of SAMPLE_TASKS) {
      console.log(`  Creating: ${task.title}`)
      await createTask(page, task.title, task.recurring as 'daily' | 'weekly', task.time)
    }

    console.log(`\nCreated ${SAMPLE_TASKS.length} tasks!`)
  } finally {
    await browser.close()
  }
}

async function cleanupTasks() {
  console.log('Cleaning up seeded tasks...\n')

  const browser = await chromium.launch({ headless: !headed })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    await login(page)
    console.log('Logged in successfully\n')

    let deleted = 0

    for (const task of SAMPLE_TASKS) {
      const fullTitle = SEED_PREFIX + task.title
      console.log(`  Deleting: ${task.title}`)

      if (await deleteTask(page, fullTitle)) {
        deleted++
      } else {
        console.log(`    (not found or already deleted)`)
      }
    }

    console.log(`\nDeleted ${deleted} tasks!`)
  } finally {
    await browser.close()
  }
}

async function main() {
  if (cleanup) {
    await cleanupTasks()
  } else {
    await seedTasks()
  }
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
