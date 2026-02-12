/**
 * Playwright Narrated Video Recording Script
 *
 * Records a video walkthrough with text-to-speech narration.
 * Step 1: Record video with timed pauses
 * Step 2: Generate narration audio
 * Step 3: Merge video + audio
 *
 * Usage:
 *   npx tsx scripts/playwright-record-narrated.ts
 *   npx tsx scripts/playwright-record-narrated.ts --headed
 */

import { chromium, Page } from 'playwright'
import * as path from 'path'
import * as fs from 'fs'
import { execSync } from 'child_process'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const VIDEO_DIR = path.join(__dirname, '../videos')
const AUDIO_DIR = path.join(VIDEO_DIR, 'audio')

const args = process.argv.slice(2)
const headed = args.includes('--headed')

// Narration segments with text
const NARRATION = [
  'Welcome to Chore Champions. A family chore tracking app where kids earn points for completing quests.',
  'Lets start by logging in.',
  'Enter your email and password, then tap sign in.',
  'After signing in, you land on the Quests page. This shows all tasks for the selected day.',
  'You can scroll through your quests and filter by time of day.',
  'Tap the plus button to create a new quest.',
  'Fill in the task details like title, points, and whether it repeats.',
  'The Family page shows all your family members. Parents can invite others using a special code.',
  'The Rewards page shows a leaderboard. Complete quests to earn points and climb the ranks!',
  'The Profile page lets you customize your avatar and display name.',
  'Thanks for watching! Start your family quest adventure today.',
]

function ensureDirs() {
  if (!fs.existsSync(VIDEO_DIR)) fs.mkdirSync(VIDEO_DIR, { recursive: true })
  if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true })
}

function cleanupAudio() {
  if (fs.existsSync(AUDIO_DIR)) {
    fs.readdirSync(AUDIO_DIR).forEach(f => fs.unlinkSync(path.join(AUDIO_DIR, f)))
    fs.rmdirSync(AUDIO_DIR)
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
  await pause(300)
}

// Generate all audio files and return total duration
function generateAudio(): number {
  console.log('Generating narration audio...')
  let totalDuration = 0

  NARRATION.forEach((text, i) => {
    const aiffFile = path.join(AUDIO_DIR, `${i.toString().padStart(2, '0')}.aiff`)
    const wavFile = path.join(AUDIO_DIR, `${i.toString().padStart(2, '0')}.wav`)

    // Generate audio
    execSync(`say -v Samantha -o "${aiffFile}" "${text.replace(/"/g, '\\"')}"`)
    execSync(`ffmpeg -y -i "${aiffFile}" "${wavFile}" 2>/dev/null`)
    fs.unlinkSync(aiffFile)

    // Get duration
    const duration = parseFloat(
      execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${wavFile}"`).toString()
    )
    totalDuration += duration
    console.log(`  Segment ${i + 1}: ${duration.toFixed(1)}s`)
  })

  // Concatenate all audio files
  const listFile = path.join(AUDIO_DIR, 'list.txt')
  const wavFiles = fs.readdirSync(AUDIO_DIR).filter(f => f.endsWith('.wav')).sort()
  fs.writeFileSync(listFile, wavFiles.map(f => `file '${f}'`).join('\n'))

  const combinedAudio = path.join(VIDEO_DIR, 'narration.wav')
  execSync(`cd "${AUDIO_DIR}" && ffmpeg -y -f concat -safe 0 -i list.txt -c copy "${combinedAudio}" 2>/dev/null`)

  console.log(`Total narration: ${totalDuration.toFixed(1)}s\n`)
  return totalDuration
}

// Calculate pause needed after each section to sync with audio
function getAudioDuration(index: number): number {
  const wavFile = path.join(AUDIO_DIR, `${index.toString().padStart(2, '0')}.wav`)
  return parseFloat(
    execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${wavFile}"`).toString()
  ) * 1000 + 800 // Add 800ms pause between sections
}

async function recordVideo() {
  const email = process.env.TEST_PARENT_EMAIL
  const password = process.env.TEST_PARENT_PASSWORD

  if (!email || !password) {
    throw new Error('TEST_PARENT_EMAIL and TEST_PARENT_PASSWORD required')
  }

  console.log('Recording video...')
  const browser = await chromium.launch({ headless: !headed })
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    recordVideo: { dir: VIDEO_DIR, size: { width: 390, height: 844 } },
  })
  const page = await context.newPage()

  try {
    // Section 0: Landing - "Welcome to Chore Champions..."
    console.log('1. Landing page...')
    await page.goto(BASE_URL)
    await waitForLoad(page)
    await pause(getAudioDuration(0))

    // Section 1: Login page - "Let's start by logging in"
    console.log('2. Login page...')
    await page.goto(`${BASE_URL}/login`)
    await waitForLoad(page)
    await pause(getAudioDuration(1))

    // Section 2: Enter credentials - "Enter your email and password"
    console.log('3. Entering credentials...')
    await page.getByLabel(/email/i).click()
    await page.getByLabel(/email/i).type(email, { delay: 40 })
    await pause(300)
    await page.getByLabel(/password/i).click()
    await page.getByLabel(/password/i).type(password, { delay: 40 })
    await pause(500)
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForURL('**/quests', { timeout: 15000 })
    await waitForLoad(page)
    // Consume remaining time for section 2
    await pause(500)

    // Section 3: Quests page - "After signing in, you land on the Quests page"
    console.log('4. Quests page...')
    await pause(getAudioDuration(3))

    // Section 4: Scroll quests - "You can scroll through your quests"
    console.log('5. Scrolling quests...')
    await page.mouse.wheel(0, 200)
    await pause(600)
    await page.mouse.wheel(0, -200)
    await pause(getAudioDuration(4) - 600)

    // Section 5: Open modal - "Tap the plus button"
    console.log('6. Opening new quest form...')
    await page.locator('button.fixed.bg-purple-600').click()
    await page.waitForSelector('text=New Quest')
    await pause(getAudioDuration(5))

    // Section 6: Fill form - "Fill in the task details"
    console.log('7. Filling quest form...')
    await page.getByPlaceholder(/clean your room/i).type('Water the plants', { delay: 70 })
    await pause(getAudioDuration(6) - 1000)

    // Close the modal before navigating
    console.log('   Closing modal...')
    await page.keyboard.press('Escape')
    await pause(500)

    // Section 7: Family page - "The Family page shows all members"
    console.log('8. Family page...')
    await page.goto(`${BASE_URL}/family`)
    await waitForLoad(page)
    await pause(1000)
    // Open invite modal briefly
    const inviteBtn = page.getByRole('button', { name: 'Invite' })
    if (await inviteBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await inviteBtn.click()
      await pause(1500)
      await page.getByRole('button', { name: 'Done' }).click()
    }
    await pause(getAudioDuration(7) - 2500)

    // Section 8: Rewards page - "The Rewards page shows a leaderboard"
    console.log('9. Rewards page...')
    await page.goto(`${BASE_URL}/rewards`)
    await waitForLoad(page)
    await page.mouse.wheel(0, 150)
    await pause(500)
    await page.mouse.wheel(0, -150)
    await pause(getAudioDuration(8) - 500)

    // Section 9: Profile page - "The Profile page lets you customize"
    console.log('10. Profile page...')
    await page.goto(`${BASE_URL}/me`)
    await waitForLoad(page)
    await pause(getAudioDuration(9))

    // Section 10: Outro - "Thanks for watching"
    console.log('11. Outro...')
    await pause(getAudioDuration(10))

  } finally {
    await page.close()
    await context.close()
    await browser.close()
  }

  // Find video file
  await pause(500)
  const files = fs.readdirSync(VIDEO_DIR).filter(f => f.endsWith('.webm') && !f.includes('demo'))
  return files.length > 0 ? path.join(VIDEO_DIR, files[files.length - 1]) : null
}

async function mergeVideoAudio(videoFile: string) {
  console.log('\nMerging video and audio...')
  const audioFile = path.join(VIDEO_DIR, 'narration.wav')
  const outputFile = path.join(VIDEO_DIR, 'demo-narrated.mp4')

  if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile)

  execSync(`ffmpeg -y -i "${videoFile}" -i "${audioFile}" -c:v libx264 -c:a aac -map 0:v -map 1:a "${outputFile}" 2>/dev/null`)

  // Cleanup
  fs.unlinkSync(videoFile)
  fs.unlinkSync(audioFile)
  cleanupAudio()

  return outputFile
}

async function main() {
  console.log('=== Narrated Demo Recording ===\n')
  ensureDirs()

  // Step 1: Generate audio
  generateAudio()

  // Step 2: Record video (timed to match audio)
  const videoFile = await recordVideo()
  if (!videoFile) {
    console.error('No video file created')
    process.exit(1)
  }

  // Step 3: Merge
  const outputFile = await mergeVideoAudio(videoFile)
  console.log(`\nDone! Video saved: ${outputFile}`)
}

main().catch((error) => {
  console.error('Error:', error)
  cleanupAudio()
  process.exit(1)
})
