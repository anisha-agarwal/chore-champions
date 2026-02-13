import { test, expect } from '@playwright/test'

test.describe('Family Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/family')
    // Wait for page to load by checking for the header
    await expect(page.locator('header h1')).toBeVisible({ timeout: 10000 })
  })

  test('displays family name in header', async ({ page }) => {
    // Family name should be visible as the main heading
    const header = page.locator('header h1')
    await expect(header).toBeVisible()
    // Should not show "Family" if user has a family (shows family name instead)
    const headerText = await header.textContent()
    expect(headerText).toBeTruthy()
  })

  test('displays member count', async ({ page }) => {
    // Should show "X members" text
    await expect(page.getByText(/\d+ members?/)).toBeVisible()
  })

  test('displays Parents section with members', async ({ page }) => {
    // Parents section header
    await expect(page.getByRole('heading', { name: 'Parents' })).toBeVisible()

    // Should have at least one parent card
    const parentSection = page.locator('section').filter({ hasText: 'Parents' })
    const parentCards = parentSection.locator('.p-4')
    await expect(parentCards.first()).toBeVisible()
  })

  test('displays Kids section when children exist', async ({ page }) => {
    // Kids section may or may not exist depending on family
    const kidsSection = page.getByRole('heading', { name: 'Kids' })

    // If kids section exists, verify it has content
    if (await kidsSection.isVisible()) {
      const section = page.locator('section').filter({ hasText: 'Kids' })
      await expect(section).toBeVisible()
    }
  })

  test('invite button visible for parent users', async ({ page }) => {
    // Invite button should be visible in header for parents
    await expect(page.getByRole('button', { name: 'Invite' })).toBeVisible()
  })

  test('opens invite modal when clicking Invite button', async ({ page }) => {
    // Click invite button
    await page.getByRole('button', { name: 'Invite' }).click()

    // Modal should open with invite code
    await expect(page.getByText(/invite code/i)).toBeVisible()
  })

  test('invite modal shows share options', async ({ page }) => {
    // Open invite modal
    await page.getByRole('button', { name: 'Invite' }).click()

    // Should show the invite code and copy option
    await expect(page.getByRole('button', { name: /copy/i }).first()).toBeVisible()
  })

  test('can close invite modal', async ({ page }) => {
    // Open invite modal
    await page.getByRole('button', { name: 'Invite' }).click()
    await expect(page.getByText(/invite code/i)).toBeVisible()

    // Close modal using Done button
    await page.getByRole('button', { name: 'Done' }).click()

    // Modal should close
    await expect(page.getByRole('heading', { name: 'Invite Family Member' })).not.toBeVisible()
  })

  test('member cards show avatar and name', async ({ page }) => {
    // Find a member card
    const memberCard = page.locator('.p-4').first()
    await expect(memberCard).toBeVisible()

    // Should have avatar (img or fallback div)
    const avatar = memberCard.locator('img, .rounded-full')
    await expect(avatar.first()).toBeVisible()
  })

  test('member cards show points', async ({ page }) => {
    // Member cards should display points
    await expect(page.getByText(/\d+ pts/).first()).toBeVisible()
  })

  test('remove button visible on other members for parents', async ({ page }) => {
    // Find member cards that have the remove button
    const removeButtons = page.getByTitle('Remove member')
    const count = await removeButtons.count()

    // Should have at least one remove button if there are other members
    // (button is not shown on own card)
    if (count > 0) {
      await expect(removeButtons.first()).toBeVisible()
    }
  })

  test('clicking remove button opens confirmation modal', async ({ page }) => {
    const removeButton = page.getByTitle('Remove member').first()

    if (await removeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await removeButton.click()

      // Confirmation modal should appear
      await expect(page.getByRole('heading', { name: /remove family member/i })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Remove', exact: true })).toBeVisible()

      // Close modal
      await page.getByRole('button', { name: 'Cancel' }).click()
      await expect(page.getByRole('heading', { name: /remove family member/i })).not.toBeVisible()
    }
  })

  test('cancel remove does not remove member', async ({ page }) => {
    const removeButton = page.getByTitle('Remove member').first()

    if (await removeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Get initial member count
      const initialCount = await page.getByText(/\d+ members?/).textContent()

      // Open remove modal and cancel
      await removeButton.click()
      await expect(page.getByRole('heading', { name: /remove family member/i })).toBeVisible()
      await page.getByRole('button', { name: 'Cancel' }).click()

      // Member count should be unchanged
      await expect(page.getByText(initialCount!)).toBeVisible()
    }
  })

  test('invite code works case-insensitively', async ({ page, context }) => {
    // Open invite modal to get the code
    await page.getByRole('button', { name: 'Invite' }).click()
    await expect(page.getByText(/invite code/i)).toBeVisible()

    // Get the invite code from the modal (it's displayed in a monospace font)
    const codeElement = page.locator('.font-mono.text-2xl')
    const inviteCode = await codeElement.textContent()
    expect(inviteCode).toBeTruthy()

    // Close the modal
    await page.getByRole('button', { name: 'Done' }).click()

    // Open a new page (unauthenticated) to test the invite code
    const newPage = await context.newPage()

    // Test with UPPERCASE version
    await newPage.goto(`/join/${inviteCode!.toUpperCase()}`)
    await expect(newPage.getByRole('heading', { name: /join family/i })).toBeVisible({ timeout: 10000 })
    await expect(newPage.getByText(/you've been invited/i)).toBeVisible()

    // Test with lowercase version in a fresh page
    const lowerPage = await context.newPage()
    await lowerPage.goto(`/join/${inviteCode!.toLowerCase()}`)
    await expect(lowerPage.getByRole('heading', { name: /join family/i })).toBeVisible({ timeout: 10000 })
    await expect(lowerPage.getByText(/you've been invited/i)).toBeVisible()

    // Cleanup
    await newPage.close()
    await lowerPage.close()
  })
})
