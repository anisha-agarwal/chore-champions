jest.retryTimes(1, { logErrorsBeforeRetry: true })

import {
  callRpcAsUser,
  ensureDbTestUser,
  cleanupAndReset,
  createDailyTask,
  completeTaskOnDate,
  runSQLWithRetry,
} from './helpers/db-test-helpers'

let userId: string
let familyId: string

beforeAll(async () => {
  const user = await ensureDbTestUser()
  userId = user.userId
  familyId = user.familyId
  await cleanupAndReset(userId)
})

afterAll(async () => {
  await cleanupAndReset(userId)
})

afterEach(async () => {
  await cleanupAndReset(userId)
})

// ─── get_kid_analytics ──────────────────────────────────────────────────────

describe('get_kid_analytics', () => {
  it('returns empty arrays when user has no completions', async () => {
    const result = await callRpcAsUser(
      userId,
      `get_kid_analytics('${userId}'::uuid)`
    )
    const rows = result as Array<{ get_kid_analytics: Record<string, unknown> }>
    expect(rows).toHaveLength(1)
    const data = rows[0].get_kid_analytics
    expect(data.daily_points).toEqual([])
    expect(data.task_breakdown).toEqual([])
    expect(data.milestones).toEqual([])
    expect(data.completions_this_week).toBe(0)
    expect(data.completions_last_week).toBe(0)
  })

  it('returns completions_this_week for today', async () => {
    const taskId = await createDailyTask(familyId, userId, 'Analytics Task 1')
    await completeTaskOnDate(taskId, userId, 'CURRENT_DATE')

    const result = await callRpcAsUser(
      userId,
      `get_kid_analytics('${userId}'::uuid)`
    )
    const rows = result as Array<{ get_kid_analytics: Record<string, unknown> }>
    const data = rows[0].get_kid_analytics
    expect(data.completions_this_week).toBe(1)
    expect(data.completions_last_week).toBe(0)
  })

  it('counts last week completions separately', async () => {
    const taskId = await createDailyTask(familyId, userId, 'Analytics Task Last Week')
    // Complete 8 days ago (last week)
    await completeTaskOnDate(taskId, userId, 'CURRENT_DATE - 8')

    const result = await callRpcAsUser(
      userId,
      `get_kid_analytics('${userId}'::uuid)`
    )
    const rows = result as Array<{ get_kid_analytics: Record<string, unknown> }>
    const data = rows[0].get_kid_analytics
    expect(data.completions_this_week).toBe(0)
    expect(Number(data.completions_last_week)).toBeGreaterThanOrEqual(1)
  })

  it('respects p_weeks parameter and excludes older data', async () => {
    const taskId = await createDailyTask(familyId, userId, 'Analytics Task Old')
    // Complete 100 days ago — outside any reasonable p_weeks window
    await completeTaskOnDate(taskId, userId, 'CURRENT_DATE - 100')

    const result = await callRpcAsUser(
      userId,
      `get_kid_analytics('${userId}'::uuid, 4)`
    )
    const rows = result as Array<{ get_kid_analytics: Record<string, unknown> }>
    const data = rows[0].get_kid_analytics
    expect((data.daily_points as unknown[]).length).toBe(0)
  })

  it('includes daily_points when completions exist', async () => {
    const taskId = await createDailyTask(familyId, userId, 'Analytics Task Daily')
    await completeTaskOnDate(taskId, userId, 'CURRENT_DATE')

    const result = await callRpcAsUser(
      userId,
      `get_kid_analytics('${userId}'::uuid)`
    )
    const rows = result as Array<{ get_kid_analytics: Record<string, unknown> }>
    const data = rows[0].get_kid_analytics
    const daily = data.daily_points as Array<{ date: string; points: number; completions: number }>
    expect(daily.length).toBeGreaterThan(0)
    expect(daily[0]).toHaveProperty('date')
    expect(daily[0]).toHaveProperty('points')
    expect(daily[0]).toHaveProperty('completions')
  })

  it('includes task_breakdown with task title', async () => {
    const taskId = await createDailyTask(familyId, userId, 'My Breakdown Task')
    await completeTaskOnDate(taskId, userId, 'CURRENT_DATE')

    const result = await callRpcAsUser(
      userId,
      `get_kid_analytics('${userId}'::uuid)`
    )
    const rows = result as Array<{ get_kid_analytics: Record<string, unknown> }>
    const data = rows[0].get_kid_analytics
    const breakdown = data.task_breakdown as Array<{ task_id: string; title: string; count: number }>
    expect(breakdown.some((t) => t.title === 'My Breakdown Task')).toBe(true)
  })

  it('raises error when called as different user', async () => {
    const otherId = '00000000-0000-0000-0000-000000000001'
    await expect(
      callRpcAsUser(userId, `get_kid_analytics('${otherId}'::uuid)`)
    ).rejects.toThrow()
  })
})

// ─── get_kid_heatmap ─────────────────────────────────────────────────────────

describe('get_kid_heatmap', () => {
  it('returns empty heatmap_data when user has no completions', async () => {
    const result = await callRpcAsUser(
      userId,
      `get_kid_heatmap('${userId}'::uuid)`
    )
    const rows = result as Array<{ get_kid_heatmap: Record<string, unknown> }>
    expect(rows).toHaveLength(1)
    const data = rows[0].get_kid_heatmap
    expect(data.heatmap_data).toEqual([])
  })

  it('returns daily data within 52-week window', async () => {
    const taskId = await createDailyTask(familyId, userId, 'Heatmap Task')
    await completeTaskOnDate(taskId, userId, 'CURRENT_DATE')

    const result = await callRpcAsUser(
      userId,
      `get_kid_heatmap('${userId}'::uuid)`
    )
    const rows = result as Array<{ get_kid_heatmap: Record<string, unknown> }>
    const data = rows[0].get_kid_heatmap
    const heatmap = data.heatmap_data as Array<{ date: string; points: number; completions: number }>
    expect(heatmap.length).toBeGreaterThan(0)
    expect(heatmap[0]).toHaveProperty('date')
    expect(heatmap[0]).toHaveProperty('completions')
  })

  it('excludes data older than 52 weeks', async () => {
    const taskId = await createDailyTask(familyId, userId, 'Old Heatmap Task')
    // 400 days ago is outside the 52-week (364-day) window
    await completeTaskOnDate(taskId, userId, 'CURRENT_DATE - 400')

    const result = await callRpcAsUser(
      userId,
      `get_kid_heatmap('${userId}'::uuid)`
    )
    const rows = result as Array<{ get_kid_heatmap: Record<string, unknown> }>
    const data = rows[0].get_kid_heatmap
    expect((data.heatmap_data as unknown[]).length).toBe(0)
  })

  it('raises error when called as different user', async () => {
    const otherId = '00000000-0000-0000-0000-000000000001'
    await expect(
      callRpcAsUser(userId, `get_kid_heatmap('${otherId}'::uuid)`)
    ).rejects.toThrow()
  })
})

// ─── get_family_analytics ────────────────────────────────────────────────────

describe('get_family_analytics', () => {
  it('raises error when user is not a parent', async () => {
    // The test user is set up as a child role by ensureDbTestUser
    await expect(
      callRpcAsUser(userId, `get_family_analytics('${familyId}'::uuid)`)
    ).rejects.toThrow()
  })

  it('raises error when called for a different family', async () => {
    const otherId = '00000000-0000-0000-0000-000000000001'
    await expect(
      callRpcAsUser(userId, `get_family_analytics('${otherId}'::uuid)`)
    ).rejects.toThrow()
  })

  it('returns family analytics when user is a parent in that family', async () => {
    // Temporarily promote test user to parent
    await runSQLWithRetry(`UPDATE profiles SET role = 'parent' WHERE id = '${userId}'`)

    try {
      const result = await callRpcAsUser(
        userId,
        `get_family_analytics('${familyId}'::uuid)`
      )
      const rows = result as Array<{ get_family_analytics: Record<string, unknown> }>
      expect(rows).toHaveLength(1)
      const data = rows[0].get_family_analytics
      expect(Array.isArray(data.children)).toBe(true)
      expect(Array.isArray(data.daily_totals)).toBe(true)
      expect(Array.isArray(data.top_tasks)).toBe(true)
      expect(Array.isArray(data.bottom_tasks)).toBe(true)
      expect(typeof data.family_completion_rate).toBe('number')
    } finally {
      // Restore child role
      await runSQLWithRetry(`UPDATE profiles SET role = 'child' WHERE id = '${userId}'`)
    }
  })
})
