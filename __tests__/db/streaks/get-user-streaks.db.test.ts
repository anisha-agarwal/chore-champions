jest.retryTimes(1, { logErrorsBeforeRetry: true })

import {
  callRpcAsUser,
  ensureDbTestUser,
  cleanupAndReset,
  createDailyTask,
  completeTaskOnDate,
  runSQLWithRetry,
} from '../helpers/db-test-helpers'

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

describe('get_user_streaks', () => {
  it('returns zero streaks when user has no completions', async () => {
    const result = await callRpcAsUser(
      userId,
      `get_user_streaks('${userId}'::uuid)`
    )

    const rows = result as Array<{ get_user_streaks: Record<string, unknown> }>
    expect(rows).toHaveLength(1)
    const data = rows[0].get_user_streaks
    expect(data).toMatchObject({
      active_day_streak: 0,
      perfect_day_streak: 0,
      task_streaks: [],
    })
  })

  it('returns active day streak of 1 for completion today', async () => {
    const taskId = await createDailyTask(familyId, userId, 'Streak Test Task 1')
    await completeTaskOnDate(taskId, userId, 'CURRENT_DATE')

    const result = await callRpcAsUser(
      userId,
      `get_user_streaks('${userId}'::uuid)`
    )

    const rows = result as Array<{ get_user_streaks: Record<string, unknown> }>
    const data = rows[0].get_user_streaks
    expect(data.active_day_streak).toBe(1)
  })

  it('returns active day streak of 3 for three consecutive days', async () => {
    const taskId = await createDailyTask(familyId, userId, 'Streak Test Task 2')
    await completeTaskOnDate(taskId, userId, 'CURRENT_DATE')
    await completeTaskOnDate(taskId, userId, 'CURRENT_DATE - INTERVAL \'1 day\'')
    await completeTaskOnDate(taskId, userId, 'CURRENT_DATE - INTERVAL \'2 days\'')

    const result = await callRpcAsUser(
      userId,
      `get_user_streaks('${userId}'::uuid)`
    )

    const rows = result as Array<{ get_user_streaks: Record<string, unknown> }>
    const data = rows[0].get_user_streaks
    expect(data.active_day_streak).toBe(3)
  })

  it('breaks active day streak on a gap', async () => {
    const taskId = await createDailyTask(familyId, userId, 'Streak Gap Task')
    // Complete today and 2 days ago, skip yesterday
    await completeTaskOnDate(taskId, userId, 'CURRENT_DATE')
    await completeTaskOnDate(taskId, userId, 'CURRENT_DATE - INTERVAL \'2 days\'')

    const result = await callRpcAsUser(
      userId,
      `get_user_streaks('${userId}'::uuid)`
    )

    const rows = result as Array<{ get_user_streaks: Record<string, unknown> }>
    const data = rows[0].get_user_streaks
    // Gap on yesterday breaks the streak, so it should be 1 (just today)
    expect(data.active_day_streak).toBe(1)
  })

  it('returns zero active day streak when last completion was yesterday with gap before', async () => {
    const taskId = await createDailyTask(familyId, userId, 'Yesterday Only Task')
    // Only complete yesterday, not today
    await completeTaskOnDate(taskId, userId, 'CURRENT_DATE - INTERVAL \'1 day\'')

    const result = await callRpcAsUser(
      userId,
      `get_user_streaks('${userId}'::uuid)`
    )

    const rows = result as Array<{ get_user_streaks: Record<string, unknown> }>
    const data = rows[0].get_user_streaks
    // No completion today, so streak should start counting from today (which has nothing)
    // The loop starts at CURRENT_DATE. If today has no completion, streak is 0.
    expect(data.active_day_streak).toBe(0)
  })

  it('computes perfect day streak when all daily tasks are completed', async () => {
    const task1Id = await createDailyTask(familyId, userId, 'Perfect Task A')
    const task2Id = await createDailyTask(familyId, userId, 'Perfect Task B')
    // Complete both tasks today and yesterday
    await completeTaskOnDate(task1Id, userId, 'CURRENT_DATE')
    await completeTaskOnDate(task2Id, userId, 'CURRENT_DATE')
    await completeTaskOnDate(task1Id, userId, 'CURRENT_DATE - INTERVAL \'1 day\'')
    await completeTaskOnDate(task2Id, userId, 'CURRENT_DATE - INTERVAL \'1 day\'')

    const result = await callRpcAsUser(
      userId,
      `get_user_streaks('${userId}'::uuid)`
    )

    const rows = result as Array<{ get_user_streaks: Record<string, unknown> }>
    const data = rows[0].get_user_streaks
    expect(data.perfect_day_streak).toBe(2)
  })

  it('breaks perfect day streak when not all daily tasks are completed', async () => {
    const task1Id = await createDailyTask(familyId, userId, 'Partial Task A')
    await createDailyTask(familyId, userId, 'Partial Task B')
    // Only complete one of two tasks today
    await completeTaskOnDate(task1Id, userId, 'CURRENT_DATE')

    const result = await callRpcAsUser(
      userId,
      `get_user_streaks('${userId}'::uuid)`
    )

    const rows = result as Array<{ get_user_streaks: Record<string, unknown> }>
    const data = rows[0].get_user_streaks
    expect(data.perfect_day_streak).toBe(0)
  })

  it('computes task-specific streaks', async () => {
    const taskId = await createDailyTask(familyId, userId, 'Task Streak Test')
    await completeTaskOnDate(taskId, userId, 'CURRENT_DATE')
    await completeTaskOnDate(taskId, userId, 'CURRENT_DATE - INTERVAL \'1 day\'')

    const result = await callRpcAsUser(
      userId,
      `get_user_streaks('${userId}'::uuid)`
    )

    const rows = result as Array<{ get_user_streaks: Record<string, unknown> }>
    const data = rows[0].get_user_streaks
    const taskStreaks = data.task_streaks as Array<{ task_id: string; current_streak: number }>
    const streak = taskStreaks.find(s => s.task_id === taskId)
    expect(streak).toBeDefined()
    expect(streak!.current_streak).toBe(2)
  })

  it('counts freeze days toward active day streak', async () => {
    const taskId = await createDailyTask(familyId, userId, 'Freeze Active Task')
    // Complete today and 2 days ago, freeze yesterday
    await completeTaskOnDate(taskId, userId, 'CURRENT_DATE')
    await completeTaskOnDate(taskId, userId, 'CURRENT_DATE - INTERVAL \'2 days\'')

    // Insert a freeze usage for yesterday on the active_day streak
    await runSQLWithRetry(`
      INSERT INTO streak_freezes (user_id, available, used)
      VALUES ('${userId}', 1, 1)
      ON CONFLICT (user_id) DO UPDATE SET available = 1, used = 1;
      INSERT INTO streak_freeze_usage (user_id, freeze_date, streak_type)
      VALUES ('${userId}', CURRENT_DATE - INTERVAL '1 day', 'active_day');
    `)

    const result = await callRpcAsUser(
      userId,
      `get_user_streaks('${userId}'::uuid)`
    )

    const rows = result as Array<{ get_user_streaks: Record<string, unknown> }>
    const data = rows[0].get_user_streaks
    // Today (completion) + yesterday (freeze) + 2 days ago (completion) = 3
    expect(data.active_day_streak).toBe(3)
  })

  it('counts freeze days toward task-specific streak', async () => {
    const taskId = await createDailyTask(familyId, userId, 'Freeze Task Streak')
    // Complete today and 2 days ago
    await completeTaskOnDate(taskId, userId, 'CURRENT_DATE')
    await completeTaskOnDate(taskId, userId, 'CURRENT_DATE - INTERVAL \'2 days\'')

    // Freeze yesterday for this specific task
    await runSQLWithRetry(`
      INSERT INTO streak_freezes (user_id, available, used)
      VALUES ('${userId}', 1, 1)
      ON CONFLICT (user_id) DO UPDATE SET available = 1, used = 1;
      INSERT INTO streak_freeze_usage (user_id, freeze_date, streak_type, task_id)
      VALUES ('${userId}', CURRENT_DATE - INTERVAL '1 day', 'task', '${taskId}');
    `)

    const result = await callRpcAsUser(
      userId,
      `get_user_streaks('${userId}'::uuid)`
    )

    const rows = result as Array<{ get_user_streaks: Record<string, unknown> }>
    const data = rows[0].get_user_streaks
    const taskStreaks = data.task_streaks as Array<{ task_id: string; current_streak: number }>
    const streak = taskStreaks.find(s => s.task_id === taskId)
    expect(streak).toBeDefined()
    expect(streak!.current_streak).toBe(3)
  })

  it('counts freeze days toward perfect day streak', async () => {
    const task1Id = await createDailyTask(familyId, userId, 'Perfect Freeze A')
    const task2Id = await createDailyTask(familyId, userId, 'Perfect Freeze B')
    // Complete both tasks today and 2 days ago
    await completeTaskOnDate(task1Id, userId, 'CURRENT_DATE')
    await completeTaskOnDate(task2Id, userId, 'CURRENT_DATE')
    await completeTaskOnDate(task1Id, userId, 'CURRENT_DATE - INTERVAL \'2 days\'')
    await completeTaskOnDate(task2Id, userId, 'CURRENT_DATE - INTERVAL \'2 days\'')

    // Freeze yesterday for perfect_day
    await runSQLWithRetry(`
      INSERT INTO streak_freezes (user_id, available, used)
      VALUES ('${userId}', 1, 1)
      ON CONFLICT (user_id) DO UPDATE SET available = 1, used = 1;
      INSERT INTO streak_freeze_usage (user_id, freeze_date, streak_type)
      VALUES ('${userId}', CURRENT_DATE - INTERVAL '1 day', 'perfect_day');
    `)

    const result = await callRpcAsUser(
      userId,
      `get_user_streaks('${userId}'::uuid)`
    )

    const rows = result as Array<{ get_user_streaks: Record<string, unknown> }>
    const data = rows[0].get_user_streaks
    expect(data.perfect_day_streak).toBe(3)
  })

  it('returns unauthorized error when called as wrong user', async () => {
    const fakeUserId = '00000000-0000-0000-0000-000000000001'

    const result = await callRpcAsUser(
      fakeUserId,
      `get_user_streaks('${userId}'::uuid)`
    )

    const rows = result as Array<{ get_user_streaks: Record<string, unknown> }>
    const data = rows[0].get_user_streaks
    expect(data.error).toBe('Unauthorized')
  })

  it('does not throw type errors on date comparisons', async () => {
    // This test verifies the exact bug that motivated DB integration tests:
    // a date = text type mismatch that only shows up at SQL execution time
    const taskId = await createDailyTask(familyId, userId, 'Type Safety Task')
    await completeTaskOnDate(taskId, userId, 'CURRENT_DATE')

    // If there's a type mismatch, this call will throw an error
    const result = await callRpcAsUser(
      userId,
      `get_user_streaks('${userId}'::uuid)`
    )

    const rows = result as Array<{ get_user_streaks: Record<string, unknown> }>
    expect(rows).toHaveLength(1)
    expect(rows[0].get_user_streaks).toBeDefined()
    expect(rows[0].get_user_streaks.active_day_streak).toBeGreaterThanOrEqual(1)
  })

  it('returns multiple task streaks sorted by title', async () => {
    const taskBId = await createDailyTask(familyId, userId, 'Beta Task')
    const taskAId = await createDailyTask(familyId, userId, 'Alpha Task')
    await completeTaskOnDate(taskAId, userId, 'CURRENT_DATE')
    await completeTaskOnDate(taskBId, userId, 'CURRENT_DATE')

    const result = await callRpcAsUser(
      userId,
      `get_user_streaks('${userId}'::uuid)`
    )

    const rows = result as Array<{ get_user_streaks: Record<string, unknown> }>
    const data = rows[0].get_user_streaks
    const taskStreaks = data.task_streaks as Array<{ title: string; current_streak: number }>
    expect(taskStreaks.length).toBe(2)
    // Should be sorted by title alphabetically
    expect(taskStreaks[0].title).toBe('Alpha Task')
    expect(taskStreaks[1].title).toBe('Beta Task')
  })
})
