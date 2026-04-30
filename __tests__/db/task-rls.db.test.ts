/**
 * DB integration tests for task + task_completion INSERT RLS (migration 020).
 *
 * Regression guards the point-minting attack:
 *   - Kids cannot INSERT arbitrary tasks.
 *   - A family member cannot INSERT a completion row crediting someone else.
 *
 * These tests exercise RLS through PostgREST by signing in as the dedicated
 * DB test user and calling supabase-js — the Management API used elsewhere
 * bypasses RLS.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { runSQL } from '../../e2e/supabase-admin'
import { ensureDbTestUser } from './helpers/db-test-helpers'

const DB_TEST_EMAIL = 'db-test@chore-champions-test.local'
const DB_TEST_PASSWORD = 'TestPassword123!'
const SIBLING_EMAIL = `db-test-sibling-${Date.now()}@chore-champions-test.local`

let client: SupabaseClient
let childUserId: string
let siblingUserId: string
let familyId: string
let seedTaskId: string

async function createAuthUser(email: string): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
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
      user_metadata: { display_name: 'Sibling' },
    }),
  })
  if (!res.ok) throw new Error(`createAuthUser failed: ${await res.text()}`)
  const data = (await res.json()) as { id: string }
  return data.id
}

async function deleteAuthUser(userId: string): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey },
  })
}

beforeAll(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) throw new Error('Supabase env vars missing')

  const user = await ensureDbTestUser()
  childUserId = user.userId
  familyId = user.familyId
  // Force the test user to child role (previous runs may have upgraded it).
  await runSQL(`UPDATE profiles SET role = 'child' WHERE id = '${childUserId}'`)

  client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await client.auth.signInWithPassword({
    email: DB_TEST_EMAIL,
    password: DB_TEST_PASSWORD,
  })
  if (error) throw new Error(`Sign-in failed: ${error.message}`)

  // Create a sibling auth user in the same family so we have a real FK target
  // for the "completed_by = other user" test.
  siblingUserId = await createAuthUser(SIBLING_EMAIL)
  await runSQL(`UPDATE profiles SET family_id = '${familyId}', role = 'child' WHERE id = '${siblingUserId}'`)

  // Seed a task as service role so we have something legit to try completing.
  const rows = (await runSQL(`
    INSERT INTO tasks (title, points, family_id, created_by, assigned_to)
    VALUES ('rls seed', 5, '${familyId}', '${childUserId}', '${childUserId}')
    RETURNING id;
  `)) as Array<{ id: string }>
  seedTaskId = rows[0].id
})

afterAll(async () => {
  await runSQL(`DELETE FROM task_completions WHERE task_id = '${seedTaskId}'`)
  await runSQL(`DELETE FROM tasks WHERE id = '${seedTaskId}'`)
  await client?.auth.signOut()
  if (siblingUserId) await deleteAuthUser(siblingUserId)
})

describe('Task INSERT RLS (migration 020)', () => {
  it('blocks a kid from INSERTing a task', async () => {
    const { error } = await client.from('tasks').insert({
      title: 'free pts',
      points: 1000,
      family_id: familyId,
      created_by: childUserId,
    })
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/row-level security|permission denied/i)
  })
})

describe('task_completions INSERT RLS (migration 020)', () => {
  it('blocks INSERT when completed_by does not match auth.uid()', async () => {
    const { error } = await client.from('task_completions').insert({
      task_id: seedTaskId,
      completed_by: siblingUserId,
      points_earned: 10,
    })
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/row-level security|permission denied/i)
  })

  it('allows INSERT when completed_by = auth.uid()', async () => {
    const { error } = await client.from('task_completions').insert({
      task_id: seedTaskId,
      completed_by: childUserId,
      points_earned: 5,
    })
    expect(error).toBeNull()

    const rows = (await runSQL(
      `SELECT completed_by, points_earned FROM task_completions WHERE task_id = '${seedTaskId}'`,
    )) as Array<{ completed_by: string; points_earned: number }>
    expect(rows.some((r) => r.completed_by === childUserId && r.points_earned === 5)).toBe(true)
  })
})
