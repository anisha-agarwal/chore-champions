jest.retryTimes(1, { logErrorsBeforeRetry: true })

import {
  callRpcAsUser,
  ensureDbTestUser,
  runSQLWithRetry,
} from './helpers/db-test-helpers'

let userId: string
let familyId: string

// A second "child" user for family-isolation tests
let childUserId: string

async function ensureChildUser(): Promise<string> {
  const email = 'db-test-child@chore-champions-test.local'
  const existing = await runSQLWithRetry(
    `SELECT id FROM auth.users WHERE email = '${email}' LIMIT 1`
  ) as Array<{ id: string }>
  if (existing.length > 0) return existing[0].id

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing env vars')

  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceRoleKey}`,
      'apikey': serviceRoleKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password: 'TestPassword123!',
      email_confirm: true,
      user_metadata: { display_name: 'DB Test Child' },
    }),
  })
  const data = (await res.json()) as { id: string }
  return data.id
}

async function joinFamily(childId: string, targetFamilyId: string): Promise<void> {
  // Upsert child profile into the family
  await runSQLWithRetry(`
    INSERT INTO profiles (id, family_id, display_name, role)
    VALUES ('${childId}', '${targetFamilyId}', 'DB Test Child', 'child')
    ON CONFLICT (id) DO UPDATE SET family_id = '${targetFamilyId}', role = 'child'
  `)
}

async function createReward(overrides: {
  familyId: string
  createdBy: string
  pointsCost?: number
  stock?: number | null
  active?: boolean
}): Promise<string> {
  const { familyId: fid, createdBy, pointsCost = 50, stock, active = true } = overrides
  const stockSql = stock === undefined || stock === null ? 'NULL' : stock.toString()
  const rows = await runSQLWithRetry(`
    INSERT INTO rewards (family_id, title, points_cost, stock, active, created_by)
    VALUES ('${fid}', 'Test Reward', ${pointsCost}, ${stockSql}, ${active}, '${createdBy}')
    RETURNING id
  `) as Array<{ id: string }>
  return rows[0].id
}

async function setPoints(uid: string, points: number): Promise<void> {
  await runSQLWithRetry(`UPDATE profiles SET points = ${points} WHERE id = '${uid}'`)
}

async function cleanupRewards(): Promise<void> {
  await runSQLWithRetry(`
    DELETE FROM reward_redemptions WHERE redeemed_by IN ('${userId}', '${childUserId ?? userId}');
    DELETE FROM rewards WHERE family_id = '${familyId}';
  `)
}

beforeAll(async () => {
  const user = await ensureDbTestUser()
  userId = user.userId
  familyId = user.familyId

  childUserId = await ensureChildUser()
  await joinFamily(childUserId, familyId)

  await cleanupRewards()
})

afterAll(async () => {
  await cleanupRewards()
})

afterEach(async () => {
  await cleanupRewards()
})

// ─── redeem_reward ──────────────────────────────────────────────────────────

describe('redeem_reward', () => {
  it('happy path: child redeems reward, points deducted, redemption created', async () => {
    const rewardId = await createReward({ familyId, createdBy: userId, pointsCost: 30 })
    await setPoints(childUserId, 100)

    const result = await callRpcAsUser(
      childUserId,
      `redeem_reward('${childUserId}'::uuid, '${rewardId}'::uuid)`
    )
    const rows = result as Array<{ redeem_reward: { success: boolean; points_spent: number } }>
    const data = rows[0].redeem_reward
    expect(data.success).toBe(true)
    expect(data.points_spent).toBe(30)

    // Points should be deducted
    const pts = await runSQLWithRetry(
      `SELECT points FROM profiles WHERE id = '${childUserId}'`
    ) as Array<{ points: number }>
    expect(pts[0].points).toBe(70)

    // Redemption record created
    const redemptions = await runSQLWithRetry(
      `SELECT * FROM reward_redemptions WHERE redeemed_by = '${childUserId}'`
    ) as Array<{ status: string; points_cost: number }>
    expect(redemptions).toHaveLength(1)
    expect(redemptions[0].status).toBe('pending')
    expect(redemptions[0].points_cost).toBe(30)
  })

  it('returns error when child has insufficient points', async () => {
    const rewardId = await createReward({ familyId, createdBy: userId, pointsCost: 100 })
    await setPoints(childUserId, 50)

    const result = await callRpcAsUser(
      childUserId,
      `redeem_reward('${childUserId}'::uuid, '${rewardId}'::uuid)`
    )
    const rows = result as Array<{ redeem_reward: { success: boolean; error: string } }>
    expect(rows[0].redeem_reward.success).toBe(false)
    expect(rows[0].redeem_reward.error).toMatch(/not enough points/i)
  })

  it('returns error for out-of-stock reward', async () => {
    const rewardId = await createReward({ familyId, createdBy: userId, pointsCost: 10, stock: 0 })
    await setPoints(childUserId, 100)

    const result = await callRpcAsUser(
      childUserId,
      `redeem_reward('${childUserId}'::uuid, '${rewardId}'::uuid)`
    )
    const rows = result as Array<{ redeem_reward: { success: boolean; error: string } }>
    // stock check: stock=0 inserted directly; RPC checks active, then stock > 0
    expect(rows[0].redeem_reward.success).toBe(false)
  })

  it('returns error for inactive reward', async () => {
    const rewardId = await createReward({ familyId, createdBy: userId, active: false })
    await setPoints(childUserId, 100)

    const result = await callRpcAsUser(
      childUserId,
      `redeem_reward('${childUserId}'::uuid, '${rewardId}'::uuid)`
    )
    const rows = result as Array<{ redeem_reward: { success: boolean; error: string } }>
    expect(rows[0].redeem_reward.success).toBe(false)
    expect(rows[0].redeem_reward.error).toMatch(/no longer available/i)
  })

  it('returns error when parent tries to redeem', async () => {
    const rewardId = await createReward({ familyId, createdBy: userId })
    await setPoints(userId, 100)

    const result = await callRpcAsUser(
      userId,
      `redeem_reward('${userId}'::uuid, '${rewardId}'::uuid)`
    )
    const rows = result as Array<{ redeem_reward: { success: boolean; error: string } }>
    expect(rows[0].redeem_reward.success).toBe(false)
    expect(rows[0].redeem_reward.error).toMatch(/unauthorized/i)
  })

  it('returns error for non-existent reward', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000'
    const result = await callRpcAsUser(
      childUserId,
      `redeem_reward('${childUserId}'::uuid, '${fakeId}'::uuid)`
    )
    const rows = result as Array<{ redeem_reward: { success: boolean; error: string } }>
    expect(rows[0].redeem_reward.success).toBe(false)
    expect(rows[0].redeem_reward.error).toMatch(/not found/i)
  })

  it('decrements stock for limited rewards', async () => {
    const rewardId = await createReward({ familyId, createdBy: userId, pointsCost: 10, stock: 3 })
    await setPoints(childUserId, 100)

    await callRpcAsUser(
      childUserId,
      `redeem_reward('${childUserId}'::uuid, '${rewardId}'::uuid)`
    )

    const rows = await runSQLWithRetry(
      `SELECT stock FROM rewards WHERE id = '${rewardId}'`
    ) as Array<{ stock: number }>
    expect(rows[0].stock).toBe(2)
  })
})

// ─── resolve_redemption ──────────────────────────────────────────────────────

describe('resolve_redemption', () => {
  async function createPendingRedemption(): Promise<{ redemptionId: string; rewardId: string }> {
    const rewardId = await createReward({ familyId, createdBy: userId, pointsCost: 20 })
    await setPoints(childUserId, 100)
    await callRpcAsUser(
      childUserId,
      `redeem_reward('${childUserId}'::uuid, '${rewardId}'::uuid)`
    )
    const rows = await runSQLWithRetry(
      `SELECT id FROM reward_redemptions WHERE redeemed_by = '${childUserId}' LIMIT 1`
    ) as Array<{ id: string }>
    return { redemptionId: rows[0].id, rewardId }
  }

  it('approve: sets status to approved', async () => {
    const { redemptionId } = await createPendingRedemption()

    const result = await callRpcAsUser(
      userId,
      `resolve_redemption('${userId}'::uuid, '${redemptionId}'::uuid, 'approved')`
    )
    const rows = result as Array<{ resolve_redemption: { success: boolean } }>
    expect(rows[0].resolve_redemption.success).toBe(true)

    const redemption = await runSQLWithRetry(
      `SELECT status FROM reward_redemptions WHERE id = '${redemptionId}'`
    ) as Array<{ status: string }>
    expect(redemption[0].status).toBe('approved')
  })

  it('reject: refunds points and restores stock', async () => {
    const rewardId = await createReward({ familyId, createdBy: userId, pointsCost: 20, stock: 5 })
    await setPoints(childUserId, 100)
    await callRpcAsUser(
      childUserId,
      `redeem_reward('${childUserId}'::uuid, '${rewardId}'::uuid)`
    )
    const rows = await runSQLWithRetry(
      `SELECT id FROM reward_redemptions WHERE redeemed_by = '${childUserId}' LIMIT 1`
    ) as Array<{ id: string }>
    const redemptionId = rows[0].id

    const result = await callRpcAsUser(
      userId,
      `resolve_redemption('${userId}'::uuid, '${redemptionId}'::uuid, 'rejected')`
    )
    const rpcRows = result as Array<{ resolve_redemption: { success: boolean } }>
    expect(rpcRows[0].resolve_redemption.success).toBe(true)

    // Points refunded
    const pts = await runSQLWithRetry(
      `SELECT points FROM profiles WHERE id = '${childUserId}'`
    ) as Array<{ points: number }>
    expect(pts[0].points).toBe(100) // back to original

    // Stock restored
    const stock = await runSQLWithRetry(
      `SELECT stock FROM rewards WHERE id = '${rewardId}'`
    ) as Array<{ stock: number }>
    expect(stock[0].stock).toBe(5) // back to original
  })

  it('returns error when trying to resolve already-resolved redemption', async () => {
    const { redemptionId } = await createPendingRedemption()
    await callRpcAsUser(
      userId,
      `resolve_redemption('${userId}'::uuid, '${redemptionId}'::uuid, 'approved')`
    )
    // Try to approve again
    const result = await callRpcAsUser(
      userId,
      `resolve_redemption('${userId}'::uuid, '${redemptionId}'::uuid, 'approved')`
    )
    const rows = result as Array<{ resolve_redemption: { success: boolean; error: string } }>
    expect(rows[0].resolve_redemption.success).toBe(false)
    expect(rows[0].resolve_redemption.error).toMatch(/already resolved/i)
  })

  it('returns error for invalid action', async () => {
    const { redemptionId } = await createPendingRedemption()
    const result = await callRpcAsUser(
      userId,
      `resolve_redemption('${userId}'::uuid, '${redemptionId}'::uuid, 'invalid')`
    )
    const rows = result as Array<{ resolve_redemption: { success: boolean; error: string } }>
    expect(rows[0].resolve_redemption.success).toBe(false)
    expect(rows[0].resolve_redemption.error).toMatch(/invalid action/i)
  })

  it('returns error when child tries to resolve', async () => {
    const { redemptionId } = await createPendingRedemption()
    const result = await callRpcAsUser(
      childUserId,
      `resolve_redemption('${childUserId}'::uuid, '${redemptionId}'::uuid, 'approved')`
    )
    const rows = result as Array<{ resolve_redemption: { success: boolean; error: string } }>
    expect(rows[0].resolve_redemption.success).toBe(false)
    expect(rows[0].resolve_redemption.error).toMatch(/unauthorized/i)
  })

  it('returns error for non-existent redemption', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000'
    const result = await callRpcAsUser(
      userId,
      `resolve_redemption('${userId}'::uuid, '${fakeId}'::uuid, 'approved')`
    )
    const rows = result as Array<{ resolve_redemption: { success: boolean; error: string } }>
    expect(rows[0].resolve_redemption.success).toBe(false)
    expect(rows[0].resolve_redemption.error).toMatch(/not found/i)
  })
})
