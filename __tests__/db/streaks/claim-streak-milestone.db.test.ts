jest.retryTimes(1, { logErrorsBeforeRetry: true })

import {
  callRpcAsUser,
  ensureDbTestUser,
  cleanupAndReset,
  cleanupMilestones,
  getUserPoints,
  getFreezeCount,
} from '../helpers/db-test-helpers'

const NIL_UUID = '00000000-0000-0000-0000-000000000000'

let userId: string

beforeAll(async () => {
  const user = await ensureDbTestUser()
  userId = user.userId
  await cleanupAndReset(userId)
})

afterAll(async () => {
  await cleanupAndReset(userId)
})

afterEach(async () => {
  await cleanupAndReset(userId)
})

describe('claim_streak_milestone', () => {
  it('awards 50 points and Week Warrior badge for 7-day milestone', async () => {
    const result = await callRpcAsUser(
      userId,
      `claim_streak_milestone('${userId}'::uuid, 'active_day'::text, '${NIL_UUID}'::uuid, 7, 7)`
    )

    const rows = result as Array<{ claim_streak_milestone: Record<string, unknown> }>
    expect(rows[0].claim_streak_milestone).toMatchObject({
      success: true,
      bonus: 50,
      badge: 'Week Warrior',
    })

    const points = await getUserPoints(userId)
    expect(points).toBe(50)
  })

  it('awards correct points for each milestone tier', async () => {
    const tiers = [
      { days: 7, bonus: 50, badge: 'Week Warrior' },
      { days: 14, bonus: 100, badge: 'Fortnight Fighter' },
      { days: 30, bonus: 250, badge: 'Monthly Master' },
      { days: 60, bonus: 500, badge: 'Sixty-Day Sage' },
      { days: 100, bonus: 1000, badge: 'Century Champion' },
    ]

    for (const tier of tiers) {
      // cleanupMilestones also resets points in a single API call
      await cleanupMilestones(userId)

      const result = await callRpcAsUser(
        userId,
        `claim_streak_milestone('${userId}'::uuid, 'active_day'::text, '${NIL_UUID}'::uuid, ${tier.days}, ${tier.days})`
      )

      const rows = result as Array<{ claim_streak_milestone: Record<string, unknown> }>
      expect(rows[0].claim_streak_milestone).toMatchObject({
        success: true,
        bonus: tier.bonus,
        badge: tier.badge,
      })

      const points = await getUserPoints(userId)
      expect(points).toBe(tier.bonus)
    }
  })

  it('is idempotent - second claim returns error', async () => {
    // First claim succeeds
    await callRpcAsUser(
      userId,
      `claim_streak_milestone('${userId}'::uuid, 'active_day'::text, '${NIL_UUID}'::uuid, 7, 7)`
    )

    // Second claim fails
    const result = await callRpcAsUser(
      userId,
      `claim_streak_milestone('${userId}'::uuid, 'active_day'::text, '${NIL_UUID}'::uuid, 7, 7)`
    )

    const rows = result as Array<{ claim_streak_milestone: Record<string, unknown> }>
    expect(rows[0].claim_streak_milestone).toMatchObject({
      success: false,
      error: 'Milestone already claimed',
    })

    // Points should only be awarded once (50, not 100)
    const points = await getUserPoints(userId)
    expect(points).toBe(50)
  })

  it('rejects when streak is less than milestone days', async () => {
    const result = await callRpcAsUser(
      userId,
      `claim_streak_milestone('${userId}'::uuid, 'active_day'::text, '${NIL_UUID}'::uuid, 7, 3)`
    )

    const rows = result as Array<{ claim_streak_milestone: Record<string, unknown> }>
    expect(rows[0].claim_streak_milestone).toMatchObject({
      success: false,
      error: 'Streak not long enough',
    })
  })

  it('awards a free freeze at 30-day milestone', async () => {
    const result = await callRpcAsUser(
      userId,
      `claim_streak_milestone('${userId}'::uuid, 'active_day'::text, '${NIL_UUID}'::uuid, 30, 30)`
    )

    const rows = result as Array<{ claim_streak_milestone: Record<string, unknown> }>
    expect(rows[0].claim_streak_milestone.success).toBe(true)

    const freezes = await getFreezeCount(userId)
    expect(freezes).not.toBeNull()
    expect(freezes!.available).toBeGreaterThanOrEqual(1)
  })

  it('awards a free freeze at 100-day milestone', async () => {
    const result = await callRpcAsUser(
      userId,
      `claim_streak_milestone('${userId}'::uuid, 'active_day'::text, '${NIL_UUID}'::uuid, 100, 100)`
    )

    const rows = result as Array<{ claim_streak_milestone: Record<string, unknown> }>
    expect(rows[0].claim_streak_milestone.success).toBe(true)

    const freezes = await getFreezeCount(userId)
    expect(freezes).not.toBeNull()
    expect(freezes!.available).toBeGreaterThanOrEqual(1)
  })

  it('returns unauthorized error for wrong user', async () => {
    const fakeUserId = '00000000-0000-0000-0000-000000000001'

    const result = await callRpcAsUser(
      fakeUserId,
      `claim_streak_milestone('${userId}'::uuid, 'active_day'::text, '${NIL_UUID}'::uuid, 7, 7)`
    )

    const rows = result as Array<{ claim_streak_milestone: Record<string, unknown> }>
    expect(rows[0].claim_streak_milestone).toMatchObject({
      success: false,
      error: 'Unauthorized',
    })
  })
})
