import {
  callRpcAsUser,
  ensureDbTestUser,
  cleanupStreakData,
  setUserPoints,
  getUserPoints,
  getFreezeCount,
} from '../helpers/db-test-helpers'

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

describe('buy_streak_freeze', () => {
  it('deducts 50 points and creates a freeze', async () => {
    await setUserPoints(userId, 100)

    const result = await callRpcAsUser(
      userId,
      `buy_streak_freeze('${userId}'::uuid)`
    )

    const rows = result as Array<{ buy_streak_freeze: Record<string, unknown> }>
    expect(rows[0].buy_streak_freeze).toMatchObject({ success: true })

    const points = await getUserPoints(userId)
    expect(points).toBe(50)

    const freezes = await getFreezeCount(userId)
    expect(freezes).not.toBeNull()
    expect(freezes!.available).toBe(1)
  })

  it('fails with insufficient points', async () => {
    await setUserPoints(userId, 30)

    const result = await callRpcAsUser(
      userId,
      `buy_streak_freeze('${userId}'::uuid)`
    )

    const rows = result as Array<{ buy_streak_freeze: Record<string, unknown> }>
    expect(rows[0].buy_streak_freeze).toMatchObject({
      success: false,
      error: 'Not enough points (need 50)',
    })

    // Points should be unchanged
    const points = await getUserPoints(userId)
    expect(points).toBe(30)
  })

  it('increments existing freeze count (does not replace)', async () => {
    await setUserPoints(userId, 150)

    // Buy first freeze
    await callRpcAsUser(userId, `buy_streak_freeze('${userId}'::uuid)`)
    // Buy second freeze
    await callRpcAsUser(userId, `buy_streak_freeze('${userId}'::uuid)`)

    const points = await getUserPoints(userId)
    expect(points).toBe(50) // 150 - 50 - 50

    const freezes = await getFreezeCount(userId)
    expect(freezes).not.toBeNull()
    expect(freezes!.available).toBe(2)
  })

  it('fails at exactly 49 points', async () => {
    await setUserPoints(userId, 49)

    const result = await callRpcAsUser(
      userId,
      `buy_streak_freeze('${userId}'::uuid)`
    )

    const rows = result as Array<{ buy_streak_freeze: Record<string, unknown> }>
    expect(rows[0].buy_streak_freeze.success).toBe(false)
  })

  it('returns unauthorized error for wrong user', async () => {
    const fakeUserId = '00000000-0000-0000-0000-000000000001'

    const result = await callRpcAsUser(
      fakeUserId,
      `buy_streak_freeze('${userId}'::uuid)`
    )

    const rows = result as Array<{ buy_streak_freeze: Record<string, unknown> }>
    expect(rows[0].buy_streak_freeze).toMatchObject({
      success: false,
      error: 'Unauthorized',
    })
  })
})
