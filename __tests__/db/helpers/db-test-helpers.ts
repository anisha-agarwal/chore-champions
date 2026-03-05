import { runSQL } from '../../../e2e/supabase-admin'

const DB_TEST_EMAIL = 'db-test@chore-champions-test.local'
const DB_TEST_PASSWORD = 'TestPassword123!'
const DB_TEST_DISPLAY_NAME = 'DB Test User'
const DB_TEST_FAMILY_NAME = 'DB Test Family'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface DbTestUser {
  userId: string
  familyId: string
}

let cachedUser: DbTestUser | null = null

/** Guard against malformed IDs being interpolated into SQL. */
function assertUuid(value: string, label: string): void {
  if (!UUID_REGEX.test(value)) {
    throw new Error(`${label} is not a valid UUID: ${value}`)
  }
}

/** Escape single quotes in strings interpolated into SQL. */
function escapeSql(value: string): string {
  return value.replace(/'/g, "''")
}

/**
 * Calls an RPC as a specific user by setting JWT claims via set_config.
 * The Management API returns only the last statement's result, so we
 * chain set_config calls before the actual RPC call.
 */
export async function callRpcAsUser(userId: string, rpcCall: string): Promise<unknown> {
  assertUuid(userId, 'callRpcAsUser userId')
  const sql = `
    SELECT set_config('request.jwt.claims', '{"sub":"${userId}"}', true);
    SELECT set_config('role', 'authenticated', true);
    SELECT * FROM ${rpcCall};
  `
  try {
    return await runSQL(sql)
  } catch (error) {
    throw new Error(
      `callRpcAsUser failed for RPC "${rpcCall}" as user ${userId}: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Creates an auth user via GoTrue Admin API, handling the case where the
 * user already exists (returns existing user ID instead of throwing).
 */
async function ensureAuthUserRobust(
  email: string,
  password: string,
  displayName: string
): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required')
  }

  // First check via Management API (most reliable for finding existing users)
  const existing = await runSQL(
    `SELECT id FROM auth.users WHERE email = '${email}' LIMIT 1`
  ) as Array<{ id: string }>

  if (existing.length > 0) return existing[0].id

  // Try to create via GoTrue Admin API
  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceRoleKey}`,
      'apikey': serviceRoleKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    }),
  })

  if (res.ok) {
    const data = (await res.json()) as { id: string }
    return data.id
  }

  // If creation failed due to duplicate, search by email via the admin API
  const searchRes = await fetch(
    `${supabaseUrl}/auth/v1/admin/users`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
      },
    }
  )

  if (searchRes.ok) {
    const data = (await searchRes.json()) as { users: Array<{ id: string; email: string }> }
    const user = data.users.find((u) => u.email === email)
    if (user) return user.id
  }

  // Last resort: query auth.identities which may have the user
  const identityResult = await runSQL(
    `SELECT user_id as id FROM auth.identities WHERE provider = 'email' AND provider_id = '${email}' LIMIT 1`
  ) as Array<{ id: string }>

  if (identityResult.length > 0) return identityResult[0].id

  const errText = await res.text().catch(() => 'unknown error')
  throw new Error(`Failed to create or find user ${email}: ${errText}`)
}

/**
 * Creates or retrieves the dedicated DB test user with a family and profile.
 * Caches the result within the current Jest worker process.
 */
export async function ensureDbTestUser(): Promise<DbTestUser> {
  if (cachedUser) return cachedUser

  const userId = await ensureAuthUserRobust(DB_TEST_EMAIL, DB_TEST_PASSWORD, DB_TEST_DISPLAY_NAME)

  // Check if user already has a family
  const existingProfile = await runSQL(
    `SELECT family_id FROM profiles WHERE id = '${userId}'`
  ) as Array<{ family_id: string | null }>

  let familyId: string

  if (existingProfile.length > 0 && existingProfile[0].family_id) {
    familyId = existingProfile[0].family_id
  } else {
    // Create a family for the test user
    const familyResult = await runSQL(`
      INSERT INTO families (name)
      VALUES ('${DB_TEST_FAMILY_NAME}')
      RETURNING id;
    `) as Array<{ id: string }>
    familyId = familyResult[0].id

    // Link profile to family
    await runSQL(`
      UPDATE profiles
      SET family_id = '${familyId}', role = 'child', display_name = '${DB_TEST_DISPLAY_NAME}'
      WHERE id = '${userId}';
    `)
  }

  cachedUser = { userId, familyId }
  return cachedUser
}

/**
 * Deletes all streak-related data for a user. Call in afterAll to clean up.
 * Deletion order respects FK constraints.
 */
export async function cleanupStreakData(userId: string): Promise<void> {
  assertUuid(userId, 'cleanupStreakData userId')
  await runSQL(`
    DELETE FROM streak_freeze_usage WHERE user_id = '${userId}';
    DELETE FROM streak_milestones WHERE user_id = '${userId}';
    DELETE FROM streak_freezes WHERE user_id = '${userId}';
    DELETE FROM task_completions WHERE completed_by = '${userId}';
    DELETE FROM tasks WHERE assigned_to = '${userId}';
  `)
}

/**
 * Resets the user's points to a specific value. Useful for testing
 * RPCs that deduct or award points.
 */
export async function setUserPoints(userId: string, points: number): Promise<void> {
  assertUuid(userId, 'setUserPoints userId')
  await runSQL(`UPDATE profiles SET points = ${points} WHERE id = '${userId}'`)
}

/** Verifies point balance after RPC calls that award or deduct points. */
export async function getUserPoints(userId: string): Promise<number> {
  assertUuid(userId, 'getUserPoints userId')
  const result = await runSQL(
    `SELECT points FROM profiles WHERE id = '${userId}'`
  ) as Array<{ points: number }>
  return result[0].points
}

/** Sets up a recurring task so streak computation has completions to count. */
export async function createDailyTask(
  familyId: string,
  userId: string,
  title: string
): Promise<string> {
  assertUuid(familyId, 'createDailyTask familyId')
  assertUuid(userId, 'createDailyTask userId')
  const result = await runSQL(`
    INSERT INTO tasks (family_id, title, assigned_to, points, recurring, created_by)
    VALUES ('${familyId}', '${escapeSql(title)}', '${userId}', 10, 'daily', '${userId}')
    RETURNING id;
  `) as Array<{ id: string }>
  return result[0].id
}

/**
 * Records a task completion on a specific date.
 * Uses SQL date expressions directly to avoid timezone mismatches.
 */
export async function completeTaskOnDate(
  taskId: string,
  userId: string,
  dateExpr: string
): Promise<void> {
  assertUuid(taskId, 'completeTaskOnDate taskId')
  assertUuid(userId, 'completeTaskOnDate userId')
  await runSQL(`
    INSERT INTO task_completions (task_id, completed_by, points_earned, completion_date, completed_at)
    VALUES ('${taskId}', '${userId}', 10, ${dateExpr}, now())
    ON CONFLICT (task_id, completion_date) WHERE completion_date IS NOT NULL DO NOTHING;
  `)
}

/** Verifies freeze inventory after RPCs that buy or consume freezes. */
export async function getFreezeCount(userId: string): Promise<{ available: number; used: number } | null> {
  assertUuid(userId, 'getFreezeCount userId')
  const result = await runSQL(
    `SELECT available, used FROM streak_freezes WHERE user_id = '${userId}'`
  ) as Array<{ available: number; used: number }>
  return result.length > 0 ? result[0] : null
}
