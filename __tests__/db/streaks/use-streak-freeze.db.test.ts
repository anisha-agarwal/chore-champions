import {
  callRpcAsUser,
  ensureDbTestUser,
  cleanupStreakData,
  setUserPoints,
} from '../helpers/db-test-helpers'
import { runSQL } from '../../../e2e/supabase-admin'

let userId: string

beforeAll(async () => {
  const user = await ensureDbTestUser()
  userId = user.userId
  await cleanupStreakData(userId)
})

afterAll(async () => {
  await cleanupStreakData(userId)
  await setUserPoints(userId, 0)
})

afterEach(async () => {
  await cleanupStreakData(userId)
  await setUserPoints(userId, 0)
})

/**
 * Gives the user a freeze by directly inserting into streak_freezes.
 */
async function giveFreeze(available: number, used: number = 0): Promise<void> {
  await runSQL(`
    INSERT INTO streak_freezes (user_id, available, used)
    VALUES ('${userId}', ${available}, ${used})
    ON CONFLICT (user_id) DO UPDATE SET available = ${available}, used = ${used}, updated_at = now();
  `)
}

describe('use_streak_freeze', () => {
  it('applies a freeze to a date and records usage', async () => {
    await giveFreeze(2, 0)

    const result = await callRpcAsUser(
      userId,
      `use_streak_freeze('${userId}'::uuid, CURRENT_DATE, 'active_day'::text, NULL::uuid)`
    )

    const rows = result as Array<{ use_streak_freeze: Record<string, unknown> }>
    expect(rows[0].use_streak_freeze).toMatchObject({ success: true })

    // Check that used count incremented
    const freezeResult = await runSQL(
      `SELECT available, used FROM streak_freezes WHERE user_id = '${userId}'`
    ) as Array<{ available: number; used: number }>
    expect(freezeResult[0].available).toBe(2)
    expect(freezeResult[0].used).toBe(1)

    // Check that freeze usage record was created
    const usageResult = await runSQL(
      `SELECT streak_type, freeze_date FROM streak_freeze_usage WHERE user_id = '${userId}'`
    ) as Array<{ streak_type: string; freeze_date: string }>
    expect(usageResult).toHaveLength(1)
    expect(usageResult[0].streak_type).toBe('active_day')
  })

  it('fails when no freezes are available', async () => {
    // No freezes at all
    const result = await callRpcAsUser(
      userId,
      `use_streak_freeze('${userId}'::uuid, CURRENT_DATE, 'active_day'::text, NULL::uuid)`
    )

    const rows = result as Array<{ use_streak_freeze: Record<string, unknown> }>
    expect(rows[0].use_streak_freeze).toMatchObject({
      success: false,
      error: 'No freezes available',
    })
  })

  it('fails when all freezes are already used', async () => {
    await giveFreeze(2, 2)

    const result = await callRpcAsUser(
      userId,
      `use_streak_freeze('${userId}'::uuid, CURRENT_DATE, 'active_day'::text, NULL::uuid)`
    )

    const rows = result as Array<{ use_streak_freeze: Record<string, unknown> }>
    expect(rows[0].use_streak_freeze).toMatchObject({
      success: false,
      error: 'No freezes available',
    })
  })

  it('returns unauthorized error for wrong user', async () => {
    const fakeUserId = '00000000-0000-0000-0000-000000000001'

    const result = await callRpcAsUser(
      fakeUserId,
      `use_streak_freeze('${userId}'::uuid, CURRENT_DATE, 'active_day'::text, NULL::uuid)`
    )

    const rows = result as Array<{ use_streak_freeze: Record<string, unknown> }>
    expect(rows[0].use_streak_freeze).toMatchObject({
      success: false,
      error: 'Unauthorized',
    })
  })
})
