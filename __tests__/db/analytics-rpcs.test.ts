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

  it('total_points matches profile points', async () => {
    await runSQLWithRetry(`UPDATE profiles SET points = 42 WHERE id = '${userId}'`)

    const result = await callRpcAsUser(
      userId,
      `get_kid_analytics('${userId}'::uuid)`
    )
    const rows = result as Array<{ get_kid_analytics: Record<string, unknown> }>
    const data = rows[0].get_kid_analytics
    expect(data.total_points).toBe(42)
  })

  it('task_breakdown ordered DESC by count', async () => {
    // Create two tasks with different completion counts
    const taskA = await createDailyTask(familyId, userId, 'Less Completed Task')
    const taskB = await createDailyTask(familyId, userId, 'More Completed Task')

    // taskA: 1 completion
    await completeTaskOnDate(taskA, userId, 'CURRENT_DATE')

    // taskB: 3 completions on different days
    await completeTaskOnDate(taskB, userId, 'CURRENT_DATE')
    await completeTaskOnDate(taskB, userId, 'CURRENT_DATE - 1')
    await completeTaskOnDate(taskB, userId, 'CURRENT_DATE - 2')

    const result = await callRpcAsUser(
      userId,
      `get_kid_analytics('${userId}'::uuid)`
    )
    const rows = result as Array<{ get_kid_analytics: Record<string, unknown> }>
    const data = rows[0].get_kid_analytics
    const breakdown = data.task_breakdown as Array<{ task_id: string; title: string; count: number }>

    expect(breakdown.length).toBe(2)
    // First entry should have the highest count
    expect(breakdown[0].title).toBe('More Completed Task')
    expect(breakdown[0].count).toBe(3)
    expect(breakdown[1].title).toBe('Less Completed Task')
    expect(breakdown[1].count).toBe(1)
  })

  it('milestones populated when streak_milestones exist', async () => {
    const taskId = await createDailyTask(familyId, userId, 'Milestone Task')

    // Insert a streak milestone directly
    await runSQLWithRetry(`
      INSERT INTO streak_milestones (user_id, task_id, streak_type, milestone_days, badge_name, claimed_at)
      VALUES ('${userId}', '${taskId}', 'task', 7, 'week_warrior', now())
    `)

    const result = await callRpcAsUser(
      userId,
      `get_kid_analytics('${userId}'::uuid)`
    )
    const rows = result as Array<{ get_kid_analytics: Record<string, unknown> }>
    const data = rows[0].get_kid_analytics
    const milestones = data.milestones as Array<{
      streak_type: string
      task_id: string
      milestone_days: number
      badge_name: string
      claimed_at: string
    }>
    expect(milestones.length).toBeGreaterThanOrEqual(1)
    expect(milestones.some((m) => m.badge_name === 'week_warrior')).toBe(true)
    expect(milestones.some((m) => m.milestone_days === 7)).toBe(true)
  })

  it('p_weeks clamped to minimum 1 and maximum 52', async () => {
    const taskId = await createDailyTask(familyId, userId, 'Boundary Task')
    await completeTaskOnDate(taskId, userId, 'CURRENT_DATE')

    // p_weeks = 0 should be clamped to 1 (7 days window)
    const resultMin = await callRpcAsUser(
      userId,
      `get_kid_analytics('${userId}'::uuid, 0)`
    )
    const rowsMin = resultMin as Array<{ get_kid_analytics: Record<string, unknown> }>
    const dataMin = rowsMin[0].get_kid_analytics
    // Today's completion should still be within a 1-week window
    expect((dataMin.daily_points as unknown[]).length).toBeGreaterThanOrEqual(1)

    // p_weeks = 100 should be clamped to 52
    const resultMax = await callRpcAsUser(
      userId,
      `get_kid_analytics('${userId}'::uuid, 100)`
    )
    const rowsMax = resultMax as Array<{ get_kid_analytics: Record<string, unknown> }>
    const dataMax = rowsMax[0].get_kid_analytics
    expect((dataMax.daily_points as unknown[]).length).toBeGreaterThanOrEqual(1)
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

  it('aggregates multiple completions on same day (SUM points, COUNT completions)', async () => {
    // Two different tasks completed on the same day
    const taskA = await createDailyTask(familyId, userId, 'Heatmap Agg A')
    const taskB = await createDailyTask(familyId, userId, 'Heatmap Agg B')
    await completeTaskOnDate(taskA, userId, 'CURRENT_DATE')
    await completeTaskOnDate(taskB, userId, 'CURRENT_DATE')

    const result = await callRpcAsUser(
      userId,
      `get_kid_heatmap('${userId}'::uuid)`
    )
    const rows = result as Array<{ get_kid_heatmap: Record<string, unknown> }>
    const data = rows[0].get_kid_heatmap
    const heatmap = data.heatmap_data as Array<{ date: string; points: number; completions: number }>

    // Should be exactly one day entry with aggregated values
    const todayEntries = heatmap.filter((h) => {
      // Today's date should be the only entry
      return true
    })
    expect(todayEntries.length).toBe(1)
    // Two completions at 10 points each
    expect(todayEntries[0].completions).toBe(2)
    expect(todayEntries[0].points).toBe(20)
  })

  it('includes data at exact 52-week boundary but excludes 52w+1d', async () => {
    const taskInside = await createDailyTask(familyId, userId, 'Heatmap Boundary Inside')
    const taskOutside = await createDailyTask(familyId, userId, 'Heatmap Boundary Outside')

    // 364 days ago = exactly at the boundary (current_date - 364)
    await completeTaskOnDate(taskInside, userId, 'CURRENT_DATE - 364')
    // 365 days ago = outside the boundary
    await completeTaskOnDate(taskOutside, userId, 'CURRENT_DATE - 365')

    const result = await callRpcAsUser(
      userId,
      `get_kid_heatmap('${userId}'::uuid)`
    )
    const rows = result as Array<{ get_kid_heatmap: Record<string, unknown> }>
    const data = rows[0].get_kid_heatmap
    const heatmap = data.heatmap_data as Array<{ date: string; points: number; completions: number }>

    // Should include the 364-day-ago entry but not the 365-day-ago one
    expect(heatmap.length).toBe(1)
    expect(heatmap[0].completions).toBe(1)
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

  it('children array has correct per-child completion_rate', async () => {
    // Create a second child profile in the same family
    const child2Id = '00000000-aaaa-bbbb-cccc-000000000002'
    await runSQLWithRetry(`
      INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, instance_id, aud, role, created_at, updated_at)
      VALUES ('${child2Id}', 'analytics-child2@test.local', crypt('TestPassword123!', gen_salt('bf')), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', now(), now())
      ON CONFLICT (id) DO NOTHING;
      INSERT INTO profiles (id, display_name, role, family_id)
      VALUES ('${child2Id}', 'Analytics Child 2', 'child', '${familyId}')
      ON CONFLICT (id) DO UPDATE SET role = 'child', family_id = '${familyId}';
    `)

    // Promote test user to parent so RPC succeeds
    await runSQLWithRetry(`UPDATE profiles SET role = 'parent' WHERE id = '${userId}'`)

    try {
      // Create a task assigned to child2 and complete it today
      const taskId = await createDailyTask(familyId, child2Id, 'Child2 Task')
      await completeTaskOnDate(taskId, child2Id, 'CURRENT_DATE')

      const result = await callRpcAsUser(
        userId,
        `get_family_analytics('${familyId}'::uuid)`
      )
      const rows = result as Array<{ get_family_analytics: Record<string, unknown> }>
      const data = rows[0].get_family_analytics
      const children = data.children as Array<{
        profile: { id: string; display_name: string }
        completions_this_week: number
        completion_rate: number
      }>

      // child2 should be in the children array with completions
      const child2 = children.find((c) => c.profile.id === child2Id)
      expect(child2).toBeDefined()
      expect(child2!.completions_this_week).toBeGreaterThanOrEqual(1)
      // completion_rate should be between 0 and 1
      expect(child2!.completion_rate).toBeGreaterThanOrEqual(0)
      expect(child2!.completion_rate).toBeLessThanOrEqual(1)
    } finally {
      // Cleanup child2 data
      await runSQLWithRetry(`
        DELETE FROM task_completions WHERE completed_by = '${child2Id}';
        DELETE FROM tasks WHERE assigned_to = '${child2Id}';
        DELETE FROM profiles WHERE id = '${child2Id}';
        DELETE FROM auth.users WHERE id = '${child2Id}';
      `)
      await runSQLWithRetry(`UPDATE profiles SET role = 'child' WHERE id = '${userId}'`)
    }
  })

  it('daily_totals aggregated across children', async () => {
    await runSQLWithRetry(`UPDATE profiles SET role = 'parent' WHERE id = '${userId}'`)

    // Need a child in the family for daily_totals to have data
    const childId = '00000000-aaaa-bbbb-cccc-000000000003'
    await runSQLWithRetry(`
      INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, instance_id, aud, role, created_at, updated_at)
      VALUES ('${childId}', 'analytics-child3@test.local', crypt('TestPassword123!', gen_salt('bf')), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', now(), now())
      ON CONFLICT (id) DO NOTHING;
      INSERT INTO profiles (id, display_name, role, family_id)
      VALUES ('${childId}', 'Analytics Child 3', 'child', '${familyId}')
      ON CONFLICT (id) DO UPDATE SET role = 'child', family_id = '${familyId}';
    `)

    try {
      const taskA = await createDailyTask(familyId, childId, 'DailyTotal Task A')
      const taskB = await createDailyTask(familyId, childId, 'DailyTotal Task B')
      await completeTaskOnDate(taskA, childId, 'CURRENT_DATE')
      await completeTaskOnDate(taskB, childId, 'CURRENT_DATE')

      const result = await callRpcAsUser(
        userId,
        `get_family_analytics('${familyId}'::uuid)`
      )
      const rows = result as Array<{ get_family_analytics: Record<string, unknown> }>
      const data = rows[0].get_family_analytics
      const dailyTotals = data.daily_totals as Array<{ date: string; points: number; completions: number }>

      expect(dailyTotals.length).toBeGreaterThanOrEqual(1)
      // Today should have aggregated completions
      const todayEntry = dailyTotals[dailyTotals.length - 1]
      expect(todayEntry.completions).toBeGreaterThanOrEqual(2)
      expect(todayEntry.points).toBeGreaterThanOrEqual(20)
    } finally {
      await runSQLWithRetry(`
        DELETE FROM task_completions WHERE completed_by = '${childId}';
        DELETE FROM tasks WHERE assigned_to = '${childId}';
        DELETE FROM profiles WHERE id = '${childId}';
        DELETE FROM auth.users WHERE id = '${childId}';
      `)
      await runSQLWithRetry(`UPDATE profiles SET role = 'child' WHERE id = '${userId}'`)
    }
  })

  it('top_tasks limited to 10 and ordered DESC by count', async () => {
    await runSQLWithRetry(`UPDATE profiles SET role = 'parent' WHERE id = '${userId}'`)

    const childId = '00000000-aaaa-bbbb-cccc-000000000004'
    await runSQLWithRetry(`
      INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, instance_id, aud, role, created_at, updated_at)
      VALUES ('${childId}', 'analytics-child4@test.local', crypt('TestPassword123!', gen_salt('bf')), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', now(), now())
      ON CONFLICT (id) DO NOTHING;
      INSERT INTO profiles (id, display_name, role, family_id)
      VALUES ('${childId}', 'Analytics Child 4', 'child', '${familyId}')
      ON CONFLICT (id) DO UPDATE SET role = 'child', family_id = '${familyId}';
    `)

    try {
      // Create 12 tasks and complete each a different number of times
      const taskIds: string[] = []
      for (let i = 0; i < 12; i++) {
        const id = await createDailyTask(familyId, childId, `TopTask ${i}`)
        taskIds.push(id)
        // Complete each task on a different day
        await completeTaskOnDate(id, childId, `CURRENT_DATE - ${i}`)
      }
      // Give the first task extra completions so it ranks highest
      await completeTaskOnDate(taskIds[0], childId, 'CURRENT_DATE - 20')
      await completeTaskOnDate(taskIds[0], childId, 'CURRENT_DATE - 21')

      const result = await callRpcAsUser(
        userId,
        `get_family_analytics('${familyId}'::uuid)`
      )
      const rows = result as Array<{ get_family_analytics: Record<string, unknown> }>
      const data = rows[0].get_family_analytics
      const topTasks = data.top_tasks as Array<{ task_id: string; title: string; count: number }>

      // Limited to 10
      expect(topTasks.length).toBeLessThanOrEqual(10)
      // Ordered DESC
      for (let i = 1; i < topTasks.length; i++) {
        expect(topTasks[i - 1].count).toBeGreaterThanOrEqual(topTasks[i].count)
      }
      // First entry should be the one with most completions
      expect(topTasks[0].title).toBe('TopTask 0')
    } finally {
      await runSQLWithRetry(`
        DELETE FROM task_completions WHERE completed_by = '${childId}';
        DELETE FROM tasks WHERE assigned_to = '${childId}';
        DELETE FROM profiles WHERE id = '${childId}';
        DELETE FROM auth.users WHERE id = '${childId}';
      `)
      await runSQLWithRetry(`UPDATE profiles SET role = 'child' WHERE id = '${userId}'`)
    }
  })

  it('bottom_tasks limited to 5, ordered ASC, only tasks >7 days old', async () => {
    await runSQLWithRetry(`UPDATE profiles SET role = 'parent' WHERE id = '${userId}'`)

    const childId = '00000000-aaaa-bbbb-cccc-000000000005'
    await runSQLWithRetry(`
      INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, instance_id, aud, role, created_at, updated_at)
      VALUES ('${childId}', 'analytics-child5@test.local', crypt('TestPassword123!', gen_salt('bf')), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', now(), now())
      ON CONFLICT (id) DO NOTHING;
      INSERT INTO profiles (id, display_name, role, family_id)
      VALUES ('${childId}', 'Analytics Child 5', 'child', '${familyId}')
      ON CONFLICT (id) DO UPDATE SET role = 'child', family_id = '${familyId}';
    `)

    try {
      // Create 7 tasks older than 7 days and 1 recent task
      const oldTaskIds: string[] = []
      for (let i = 0; i < 7; i++) {
        // Insert with created_at backdated > 7 days
        const result = await runSQLWithRetry(`
          INSERT INTO tasks (family_id, title, assigned_to, points, recurring, created_by, created_at)
          VALUES ('${familyId}', 'BottomTask ${i}', '${childId}', 10, 'daily', '${childId}', now() - interval '10 days')
          RETURNING id;
        `) as Array<{ id: string }>
        oldTaskIds.push(result[0].id)
      }

      // Create a recent task (should NOT appear in bottom_tasks)
      await createDailyTask(familyId, childId, 'RecentTask')

      // Don't complete any old tasks — they should all have count 0

      const result = await callRpcAsUser(
        userId,
        `get_family_analytics('${familyId}'::uuid)`
      )
      const rows = result as Array<{ get_family_analytics: Record<string, unknown> }>
      const data = rows[0].get_family_analytics
      const bottomTasks = data.bottom_tasks as Array<{ task_id: string; title: string; count: number }>

      // Limited to 5
      expect(bottomTasks.length).toBeLessThanOrEqual(5)
      // Should not include the recent task
      expect(bottomTasks.every((t) => t.title !== 'RecentTask')).toBe(true)
      // Ordered ASC by count
      for (let i = 1; i < bottomTasks.length; i++) {
        expect(bottomTasks[i - 1].count).toBeLessThanOrEqual(bottomTasks[i].count)
      }
    } finally {
      await runSQLWithRetry(`
        DELETE FROM task_completions WHERE completed_by = '${childId}';
        DELETE FROM tasks WHERE assigned_to = '${childId}';
        DELETE FROM profiles WHERE id = '${childId}';
        DELETE FROM auth.users WHERE id = '${childId}';
      `)
      await runSQLWithRetry(`UPDATE profiles SET role = 'child' WHERE id = '${userId}'`)
    }
  })

  it('multiple children with varying completions', async () => {
    await runSQLWithRetry(`UPDATE profiles SET role = 'parent' WHERE id = '${userId}'`)

    const childAId = '00000000-aaaa-bbbb-cccc-000000000006'
    const childBId = '00000000-aaaa-bbbb-cccc-000000000007'
    await runSQLWithRetry(`
      INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, instance_id, aud, role, created_at, updated_at)
      VALUES
        ('${childAId}', 'analytics-childA@test.local', crypt('TestPassword123!', gen_salt('bf')), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', now(), now()),
        ('${childBId}', 'analytics-childB@test.local', crypt('TestPassword123!', gen_salt('bf')), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', now(), now())
      ON CONFLICT (id) DO NOTHING;
      INSERT INTO profiles (id, display_name, role, family_id)
      VALUES
        ('${childAId}', 'Child A', 'child', '${familyId}'),
        ('${childBId}', 'Child B', 'child', '${familyId}')
      ON CONFLICT (id) DO UPDATE SET role = 'child', family_id = '${familyId}';
    `)

    try {
      // Child A: 3 completions, Child B: 1 completion
      const taskA1 = await createDailyTask(familyId, childAId, 'ChildA Task 1')
      const taskA2 = await createDailyTask(familyId, childAId, 'ChildA Task 2')
      const taskA3 = await createDailyTask(familyId, childAId, 'ChildA Task 3')
      const taskB1 = await createDailyTask(familyId, childBId, 'ChildB Task 1')

      await completeTaskOnDate(taskA1, childAId, 'CURRENT_DATE')
      await completeTaskOnDate(taskA2, childAId, 'CURRENT_DATE')
      await completeTaskOnDate(taskA3, childAId, 'CURRENT_DATE')
      await completeTaskOnDate(taskB1, childBId, 'CURRENT_DATE')

      const result = await callRpcAsUser(
        userId,
        `get_family_analytics('${familyId}'::uuid)`
      )
      const rows = result as Array<{ get_family_analytics: Record<string, unknown> }>
      const data = rows[0].get_family_analytics
      const children = data.children as Array<{
        profile: { id: string; display_name: string }
        completions_this_week: number
      }>

      expect(children.length).toBeGreaterThanOrEqual(2)
      const childA = children.find((c) => c.profile.id === childAId)
      const childB = children.find((c) => c.profile.id === childBId)
      expect(childA).toBeDefined()
      expect(childB).toBeDefined()
      expect(childA!.completions_this_week).toBe(3)
      expect(childB!.completions_this_week).toBe(1)
    } finally {
      await runSQLWithRetry(`
        DELETE FROM task_completions WHERE completed_by IN ('${childAId}', '${childBId}');
        DELETE FROM tasks WHERE assigned_to IN ('${childAId}', '${childBId}');
        DELETE FROM profiles WHERE id IN ('${childAId}', '${childBId}');
        DELETE FROM auth.users WHERE id IN ('${childAId}', '${childBId}');
      `)
      await runSQLWithRetry(`UPDATE profiles SET role = 'child' WHERE id = '${userId}'`)
    }
  })
})
