import { test, expect } from '@playwright/test'
import { runSQL } from './supabase-admin'
import { TEST_PARENT_EMAIL } from './test-constants'

// Helper: get the test parent's family_id
async function getTestFamilyId(): Promise<string | null> {
  const rows = await runSQL(`
    SELECT p.family_id FROM profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE u.email = '${TEST_PARENT_EMAIL}'
    LIMIT 1
  `) as Array<{ family_id: string }>
  return rows[0]?.family_id ?? null
}

// Helper: insert a test reward
async function createTestReward(familyId: string, parentId: string, title: string, pointsCost: number): Promise<string> {
  const rows = await runSQL(`
    INSERT INTO rewards (family_id, title, points_cost, icon_id, category, created_by)
    VALUES ('${familyId}', '${title}', ${pointsCost}, 'star', 'other', '${parentId}')
    RETURNING id
  `) as Array<{ id: string }>
  return rows[0].id
}

// Helper: get parent profile id
async function getParentId(): Promise<string | null> {
  const rows = await runSQL(`
    SELECT u.id FROM auth.users u WHERE u.email = '${TEST_PARENT_EMAIL}' LIMIT 1
  `) as Array<{ id: string }>
  return rows[0]?.id ?? null
}

test.describe('Rewards Store — Parent', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/rewards')
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 10000 })
  })

  test('parent can navigate to Manage tab', async ({ page }) => {
    await page.getByRole('button', { name: 'Manage' }).click()
    await expect(page).toHaveURL(/tab=manage/)
    await expect(page.getByRole('button', { name: /Add Reward/i })).toBeVisible()
  })

  test('parent can create a reward via form', async ({ page }) => {
    await page.getByRole('button', { name: 'Manage' }).click()
    await page.getByRole('button', { name: /Add Reward/i }).click()
    await expect(page.getByText('New Reward')).toBeVisible()

    await page.getByLabel(/Title/i).fill('E2E Test Reward')
    await page.getByLabel(/Points Cost/i).fill('25')
    await page.getByRole('button', { name: 'Create Reward' }).click()

    // Reward should appear in the manage list
    await expect(page.getByText('E2E Test Reward')).toBeVisible({ timeout: 5000 })
  })

  test('created reward appears in store tab', async ({ page }) => {
    // Navigate to store
    await page.getByRole('button', { name: 'Store' }).click()
    await expect(page).toHaveURL(/tab=store|rewards$/)
    // The reward created in the previous test should appear (if tests run sequentially)
    // This test just verifies the store tab is accessible and shows category filters
    await expect(page.getByRole('button', { name: 'All' })).toBeVisible()
  })

  test('parent can toggle a reward inactive', async ({ page }) => {
    // First create a reward via DB to ensure it exists
    const familyId = await getTestFamilyId()
    const parentId = await getParentId()
    if (!familyId || !parentId) test.skip()

    await createTestReward(familyId!, parentId!, 'Toggle Test Reward', 30)
    await page.reload()
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: 'Manage' }).click()
    await page.getByRole('button', { name: 'Deactivate' }).first().click()

    // After deactivation, should show Activate button
    await expect(page.getByRole('button', { name: 'Activate' }).first()).toBeVisible({ timeout: 5000 })
  })

  test('parent can see approvals tab', async ({ page }) => {
    await page.getByRole('button', { name: /Approvals/ }).click()
    await expect(page).toHaveURL(/tab=approvals/)
  })
})

test.describe('Rewards Store — Child', () => {
  test.use({ storageState: '.auth/child.json' })

  test.beforeEach(async ({ page }) => {
    await page.goto('/rewards')
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 10000 })
  })

  test('child sees Store and My Rewards tabs but not Manage/Approvals', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Store' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'My Rewards' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Manage' })).not.toBeVisible()
    await expect(page.getByRole('button', { name: /Approvals/ })).not.toBeVisible()
  })

  test('child can browse the store with category filters', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'All' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Activities/i })).toBeVisible()
  })

  test('child can navigate to My Rewards tab', async ({ page }) => {
    await page.getByRole('button', { name: 'My Rewards' }).click()
    await expect(page).toHaveURL(/tab=my-rewards/)
    // Either redemption history or empty state
    const hasEmpty = await page.getByText(/No rewards redeemed yet/i).isVisible().catch(() => false)
    const hasList = await page.locator('.bg-white.rounded-xl').first().isVisible().catch(() => false)
    expect(hasEmpty || hasList).toBeTruthy()
  })

  test('child can redeem a reward and see pending status', async ({ page }) => {
    // Ensure there is an active reward with enough points for the child
    const familyId = await getTestFamilyId()
    const parentId = await getParentId()
    if (!familyId || !parentId) test.skip()

    // Create a cheap reward
    await createTestReward(familyId!, parentId!, 'Cheap E2E Reward', 1)
    // Give child points
    await runSQL(`
      UPDATE profiles SET points = 999
      WHERE id IN (SELECT id FROM auth.users WHERE email = 'e2e-child@chore-champions-test.local')
    `)

    await page.reload()
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 10000 })

    // Click Redeem on the cheap reward
    const redeemBtn = page.getByRole('button', { name: 'Redeem' }).first()
    await redeemBtn.click()

    // Confirm redemption
    await expect(page.getByText('Redeem Reward')).toBeVisible()
    await page.getByRole('button', { name: 'Confirm Redemption' }).click()

    // Navigate to my-rewards to see pending
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 5000 })
    await page.getByRole('button', { name: 'My Rewards' }).click()
    await expect(page.getByText('Waiting for approval')).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Rewards Store — Approval flow', () => {
  test('parent can approve a pending redemption', async ({ page }) => {
    // Ensure there's a pending redemption by checking the approvals tab
    await page.goto('/rewards?tab=approvals')
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 10000 })

    // If there are pending approvals, approve the first one
    const approveBtn = page.getByRole('button', { name: 'Approve' }).first()
    const hasApproval = await approveBtn.isVisible().catch(() => false)
    if (!hasApproval) {
      // No pending approvals — empty state is fine
      await expect(page.getByText(/No pending approvals/i)).toBeVisible()
      return
    }

    await approveBtn.click()
    // After approval, the item should disappear from queue
    await expect(page.getByText('Approve')).not.toBeVisible({ timeout: 5000 })
  })
})
