jest.retryTimes(1, { logErrorsBeforeRetry: true })

import { ensureDbTestUser, runSQLWithRetry } from './helpers/db-test-helpers'

let userA: string
let userB: string

async function ensureSecondUser(): Promise<string> {
  const email = 'db-test-b@chore-champions-test.local'
  const existing = (await runSQLWithRetry(
    `SELECT id FROM auth.users WHERE email = '${email}' LIMIT 1`,
  )) as Array<{ id: string }>
  if (existing.length > 0) return existing[0].id

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing env vars')

  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password: 'TestPassword123!',
      email_confirm: true,
      user_metadata: { display_name: 'DB Test User B' },
    }),
  })
  const data = (await res.json()) as { id: string }
  return data.id
}

async function ensureProfile(userId: string): Promise<void> {
  await runSQLWithRetry(`
    INSERT INTO profiles (id, display_name, role)
    VALUES ('${userId}', 'DB Test', 'child')
    ON CONFLICT (id) DO NOTHING
  `)
}

/**
 * Runs SQL with the authenticated role set and request.jwt.claims populated
 * so RLS policies referencing auth.uid() enforce against `userId`.
 *
 * The Management API returns the result of the last statement, so the
 * caller must put the statement under test last.
 */
async function sqlAsUser(userId: string, sql: string): Promise<unknown[]> {
  return runSQLWithRetry(`
    SELECT set_config('request.jwt.claims', '{"sub":"${userId}","role":"authenticated"}', true);
    SET LOCAL ROLE authenticated;
    ${sql}
  `)
}

async function expectSqlError(
  fn: () => Promise<unknown>,
  matcher: RegExp,
): Promise<void> {
  let err: unknown
  try {
    await fn()
  } catch (e) {
    err = e
  }
  if (!err) throw new Error('Expected SQL to throw, but it did not')
  const msg = err instanceof Error ? err.message : String(err)
  expect(msg).toMatch(matcher)
}

async function cleanupAll(): Promise<void> {
  await runSQLWithRetry(`
    DELETE FROM push_subscriptions WHERE user_id IN ('${userA}', '${userB}');
    DELETE FROM notification_preferences WHERE user_id IN ('${userA}', '${userB}');
  `)
}

beforeAll(async () => {
  const primary = await ensureDbTestUser()
  userA = primary.userId

  userB = await ensureSecondUser()
  await ensureProfile(userB)

  await cleanupAll()
})

afterAll(async () => {
  await cleanupAll()
})

afterEach(async () => {
  await cleanupAll()
})

// ──────────────────────────────────────────────────────────────────────────
// push_subscriptions
// ──────────────────────────────────────────────────────────────────────────

describe('push_subscriptions RLS + constraints', () => {
  it('user can insert their own subscription', async () => {
    const rows = (await sqlAsUser(
      userA,
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh_key, auth_key)
       VALUES ('${userA}', 'https://push.example.com/a', 'pk', 'ak')
       RETURNING id`,
    )) as Array<{ id: string }>
    expect(rows).toHaveLength(1)
  })

  it('user cannot insert a subscription for a different user', async () => {
    await expectSqlError(
      () =>
        sqlAsUser(
          userA,
          `INSERT INTO push_subscriptions (user_id, endpoint, p256dh_key, auth_key)
           VALUES ('${userB}', 'https://push.example.com/x', 'pk', 'ak')
           RETURNING id`,
        ),
      /row-level security/i,
    )
  })

  it('user can only SELECT their own subscriptions', async () => {
    // Seed one row per user via the service role (bypasses RLS)
    await runSQLWithRetry(`
      INSERT INTO push_subscriptions (user_id, endpoint, p256dh_key, auth_key) VALUES
        ('${userA}', 'https://push.example.com/own-a', 'pk', 'ak'),
        ('${userB}', 'https://push.example.com/own-b', 'pk', 'ak');
    `)

    const asA = (await sqlAsUser(
      userA,
      `SELECT user_id, endpoint FROM push_subscriptions ORDER BY endpoint`,
    )) as Array<{ user_id: string; endpoint: string }>
    expect(asA).toHaveLength(1)
    expect(asA[0].user_id).toBe(userA)

    const asB = (await sqlAsUser(
      userB,
      `SELECT user_id, endpoint FROM push_subscriptions ORDER BY endpoint`,
    )) as Array<{ user_id: string; endpoint: string }>
    expect(asB).toHaveLength(1)
    expect(asB[0].user_id).toBe(userB)
  })

  it('user can DELETE their own subscription but not another user\'s', async () => {
    await runSQLWithRetry(`
      INSERT INTO push_subscriptions (user_id, endpoint, p256dh_key, auth_key) VALUES
        ('${userA}', 'https://push.example.com/del-a', 'pk', 'ak'),
        ('${userB}', 'https://push.example.com/del-b', 'pk', 'ak');
    `)

    // A tries to delete B's row — RLS filters to 0 rows affected (no error, no deletion)
    await sqlAsUser(
      userA,
      `DELETE FROM push_subscriptions WHERE endpoint = 'https://push.example.com/del-b'`,
    )
    const stillThere = (await runSQLWithRetry(
      `SELECT id FROM push_subscriptions WHERE endpoint = 'https://push.example.com/del-b'`,
    )) as Array<{ id: string }>
    expect(stillThere).toHaveLength(1)

    // A deletes its own row — succeeds
    await sqlAsUser(
      userA,
      `DELETE FROM push_subscriptions WHERE endpoint = 'https://push.example.com/del-a'`,
    )
    const ownGone = (await runSQLWithRetry(
      `SELECT id FROM push_subscriptions WHERE endpoint = 'https://push.example.com/del-a'`,
    )) as Array<{ id: string }>
    expect(ownGone).toHaveLength(0)
  })

  it('enforces UNIQUE (user_id, endpoint)', async () => {
    await sqlAsUser(
      userA,
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh_key, auth_key)
       VALUES ('${userA}', 'https://push.example.com/dup', 'pk', 'ak')
       RETURNING id`,
    )

    await expectSqlError(
      () =>
        sqlAsUser(
          userA,
          `INSERT INTO push_subscriptions (user_id, endpoint, p256dh_key, auth_key)
           VALUES ('${userA}', 'https://push.example.com/dup', 'pk2', 'ak2')
           RETURNING id`,
        ),
      /duplicate key|unique constraint/i,
    )
  })

  it('different users can share the same endpoint', async () => {
    await sqlAsUser(
      userA,
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh_key, auth_key)
       VALUES ('${userA}', 'https://push.example.com/shared', 'pk', 'ak')
       RETURNING id`,
    )
    const rows = (await sqlAsUser(
      userB,
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh_key, auth_key)
       VALUES ('${userB}', 'https://push.example.com/shared', 'pk', 'ak')
       RETURNING id`,
    )) as Array<{ id: string }>
    expect(rows).toHaveLength(1)
  })
})

// ──────────────────────────────────────────────────────────────────────────
// notification_preferences
// ──────────────────────────────────────────────────────────────────────────

describe('notification_preferences RLS + constraints', () => {
  it('user can insert their own preferences row', async () => {
    const rows = (await sqlAsUser(
      userA,
      `INSERT INTO notification_preferences (user_id)
       VALUES ('${userA}')
       RETURNING user_id, push_enabled, types_enabled, timezone`,
    )) as Array<{
      user_id: string
      push_enabled: boolean
      types_enabled: Record<string, boolean>
      timezone: string
    }>
    expect(rows).toHaveLength(1)
    expect(rows[0].push_enabled).toBe(true)
    expect(rows[0].timezone).toBe('UTC')
    expect(rows[0].types_enabled).toEqual({
      task_completed: true,
      streak_milestone: true,
      test: true,
    })
  })

  it('user cannot insert preferences for another user', async () => {
    await expectSqlError(
      () =>
        sqlAsUser(
          userA,
          `INSERT INTO notification_preferences (user_id) VALUES ('${userB}') RETURNING user_id`,
        ),
      /row-level security/i,
    )
  })

  it('user can only SELECT their own preferences', async () => {
    await runSQLWithRetry(`
      INSERT INTO notification_preferences (user_id) VALUES ('${userA}'), ('${userB}')
    `)

    const asA = (await sqlAsUser(
      userA,
      `SELECT user_id FROM notification_preferences`,
    )) as Array<{ user_id: string }>
    expect(asA).toHaveLength(1)
    expect(asA[0].user_id).toBe(userA)
  })

  it('user can UPDATE their own preferences but not another user\'s', async () => {
    await runSQLWithRetry(`
      INSERT INTO notification_preferences (user_id, push_enabled) VALUES
        ('${userA}', true),
        ('${userB}', true)
    `)

    // A attempts to disable B's notifications — RLS filters to 0 rows (no error, no update)
    await sqlAsUser(
      userA,
      `UPDATE notification_preferences SET push_enabled = false WHERE user_id = '${userB}'`,
    )
    const bValue = (await runSQLWithRetry(
      `SELECT push_enabled FROM notification_preferences WHERE user_id = '${userB}'`,
    )) as Array<{ push_enabled: boolean }>
    expect(bValue[0].push_enabled).toBe(true)

    // A updates its own row — succeeds
    await sqlAsUser(
      userA,
      `UPDATE notification_preferences SET push_enabled = false WHERE user_id = '${userA}'`,
    )
    const aValue = (await runSQLWithRetry(
      `SELECT push_enabled FROM notification_preferences WHERE user_id = '${userA}'`,
    )) as Array<{ push_enabled: boolean }>
    expect(aValue[0].push_enabled).toBe(false)
  })

  it('rejects quiet_hours_start below 0', async () => {
    await expectSqlError(
      () =>
        sqlAsUser(
          userA,
          `INSERT INTO notification_preferences (user_id, quiet_hours_start) VALUES ('${userA}', -1) RETURNING user_id`,
        ),
      /check constraint/i,
    )
  })

  it('rejects quiet_hours_start above 23', async () => {
    await expectSqlError(
      () =>
        sqlAsUser(
          userA,
          `INSERT INTO notification_preferences (user_id, quiet_hours_start) VALUES ('${userA}', 24) RETURNING user_id`,
        ),
      /check constraint/i,
    )
  })

  it('rejects quiet_hours_end below 0', async () => {
    await expectSqlError(
      () =>
        sqlAsUser(
          userA,
          `INSERT INTO notification_preferences (user_id, quiet_hours_end) VALUES ('${userA}', -5) RETURNING user_id`,
        ),
      /check constraint/i,
    )
  })

  it('accepts boundary hours 0 and 23', async () => {
    const rows = (await sqlAsUser(
      userA,
      `INSERT INTO notification_preferences (user_id, quiet_hours_start, quiet_hours_end)
       VALUES ('${userA}', 0, 23)
       RETURNING quiet_hours_start, quiet_hours_end`,
    )) as Array<{ quiet_hours_start: number; quiet_hours_end: number }>
    expect(rows[0].quiet_hours_start).toBe(0)
    expect(rows[0].quiet_hours_end).toBe(23)
  })

  it('accepts NULL for quiet hours', async () => {
    const rows = (await sqlAsUser(
      userA,
      `INSERT INTO notification_preferences (user_id, quiet_hours_start, quiet_hours_end)
       VALUES ('${userA}', NULL, NULL)
       RETURNING quiet_hours_start, quiet_hours_end`,
    )) as Array<{ quiet_hours_start: number | null; quiet_hours_end: number | null }>
    expect(rows[0].quiet_hours_start).toBeNull()
    expect(rows[0].quiet_hours_end).toBeNull()
  })

  it('updated_at trigger bumps timestamp on UPDATE', async () => {
    await runSQLWithRetry(
      `INSERT INTO notification_preferences (user_id, updated_at) VALUES ('${userA}', '2020-01-01T00:00:00Z')`,
    )
    await sqlAsUser(
      userA,
      `UPDATE notification_preferences SET push_enabled = false WHERE user_id = '${userA}'`,
    )
    const rows = (await runSQLWithRetry(
      `SELECT updated_at FROM notification_preferences WHERE user_id = '${userA}'`,
    )) as Array<{ updated_at: string }>
    expect(new Date(rows[0].updated_at).getFullYear()).toBeGreaterThan(2024)
  })
})

// ──────────────────────────────────────────────────────────────────────────
// notification_type enum
// ──────────────────────────────────────────────────────────────────────────

describe('notification_type enum', () => {
  it('casts valid values', async () => {
    const rows = (await runSQLWithRetry(
      `SELECT 'task_completed'::notification_type AS t`,
    )) as Array<{ t: string }>
    expect(rows[0].t).toBe('task_completed')
  })

  it('rejects invalid values', async () => {
    await expectSqlError(
      () => runSQLWithRetry(`SELECT 'bogus_type'::notification_type AS t`),
      /invalid input value for enum/i,
    )
  })

  it('contains all expected values', async () => {
    const rows = (await runSQLWithRetry(
      `SELECT unnest(enum_range(NULL::notification_type))::text AS t ORDER BY t`,
    )) as Array<{ t: string }>
    const values = rows.map((r) => r.t).sort()
    expect(values).toEqual(['streak_milestone', 'task_completed', 'test'])
  })
})

// ──────────────────────────────────────────────────────────────────────────
// Cascade on profile delete
// ──────────────────────────────────────────────────────────────────────────

describe('cascade on profile delete', () => {
  it('deletes push_subscriptions and notification_preferences when profile is deleted', async () => {
    // Create a throwaway user so we can delete its profile without impacting userA/userB
    const email = 'db-test-cascade@chore-champions-test.local'
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const existing = (await runSQLWithRetry(
      `SELECT id FROM auth.users WHERE email = '${email}' LIMIT 1`,
    )) as Array<{ id: string }>
    let tempId: string
    if (existing.length > 0) {
      tempId = existing[0].id
    } else {
      const res = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password: 'TestPassword123!', email_confirm: true }),
      })
      tempId = ((await res.json()) as { id: string }).id
    }

    await runSQLWithRetry(`
      INSERT INTO profiles (id, display_name, role)
      VALUES ('${tempId}', 'Cascade Test', 'child')
      ON CONFLICT (id) DO NOTHING;
      INSERT INTO push_subscriptions (user_id, endpoint, p256dh_key, auth_key)
      VALUES ('${tempId}', 'https://push.example.com/cascade', 'pk', 'ak');
      INSERT INTO notification_preferences (user_id) VALUES ('${tempId}');
    `)

    // Delete profile — FK cascades
    await runSQLWithRetry(`DELETE FROM profiles WHERE id = '${tempId}'`)

    const subs = (await runSQLWithRetry(
      `SELECT id FROM push_subscriptions WHERE user_id = '${tempId}'`,
    )) as unknown[]
    expect(subs).toHaveLength(0)

    const prefs = (await runSQLWithRetry(
      `SELECT user_id FROM notification_preferences WHERE user_id = '${tempId}'`,
    )) as unknown[]
    expect(prefs).toHaveLength(0)

    // Clean up the temp auth user
    await fetch(`${supabaseUrl}/auth/v1/admin/users/${tempId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
    })
  })
})
