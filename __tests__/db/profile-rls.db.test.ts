/**
 * DB integration tests for profile UPDATE restrictions (migration 022).
 *
 * Verifies:
 *   - The trigger blocks self-changes to role / points / family_id.
 *   - The trigger lets self-changes to display_name / nickname / avatar_url through.
 *   - create_family_as_parent + join_family_via_invite_code RPCs work as expected.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { runSQL } from '../../e2e/supabase-admin'
import { ensureDbTestUser } from './helpers/db-test-helpers'

const DB_TEST_EMAIL = 'db-test@chore-champions-test.local'
const DB_TEST_PASSWORD = 'TestPassword123!'

let client: SupabaseClient
let userId: string
let familyId: string

beforeAll(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) throw new Error('Supabase env vars missing')

  const seed = await ensureDbTestUser()
  userId = seed.userId
  familyId = seed.familyId
  // Ensure the seed user is a 'child' for the self-update tests.
  await runSQL(`UPDATE profiles SET role = 'child', points = 0 WHERE id = '${userId}'`)

  client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await client.auth.signInWithPassword({
    email: DB_TEST_EMAIL,
    password: DB_TEST_PASSWORD,
  })
  if (error) throw new Error(`Sign-in failed: ${error.message}`)
})

afterAll(async () => {
  await client?.auth.signOut()
})

describe('profile UPDATE trigger (migration 022)', () => {
  it('blocks self-promotion to parent role', async () => {
    const { error } = await client
      .from('profiles')
      .update({ role: 'parent' })
      .eq('id', userId)
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/role/i)
  })

  it('blocks self-grant of points', async () => {
    const { error } = await client
      .from('profiles')
      .update({ points: 999999 })
      .eq('id', userId)
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/points/i)
  })

  it('blocks self-change of family_id', async () => {
    const { error } = await client
      .from('profiles')
      .update({ family_id: '00000000-0000-0000-0000-000000000001' })
      .eq('id', userId)
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/family_id/i)
  })

  it('allows self-update of display_name + nickname', async () => {
    const newName = `Renamed ${Date.now()}`
    const { error } = await client
      .from('profiles')
      .update({ display_name: newName, nickname: 'Tester' })
      .eq('id', userId)
    expect(error).toBeNull()

    const rows = (await runSQL(
      `SELECT display_name, nickname FROM profiles WHERE id = '${userId}'`,
    )) as Array<{ display_name: string; nickname: string }>
    expect(rows[0].display_name).toBe(newName)
    expect(rows[0].nickname).toBe('Tester')

    // Restore so other tests / reruns aren't surprised.
    await runSQL(
      `UPDATE profiles SET display_name = 'DB Test User', nickname = NULL WHERE id = '${userId}'`,
    )
  })
})

describe('create_family_as_parent + join_family_via_invite_code RPCs', () => {
  // Each test uses a fresh transient auth user with no family so we don't
  // disturb the seed user's permanent membership.
  let transientUserId: string
  let transientClient: SupabaseClient
  const transientEmail = `db-test-rpc-${Date.now()}@chore-champions-test.local`
  const transientPassword = 'TestPassword123!'

  async function createTransientUser(): Promise<void> {
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
        email: transientEmail,
        password: transientPassword,
        email_confirm: true,
        user_metadata: { display_name: 'Transient' },
      }),
    })
    if (!res.ok) throw new Error(`createTransientUser failed: ${await res.text()}`)
    const body = (await res.json()) as { id: string }
    transientUserId = body.id

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    transientClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { error } = await transientClient.auth.signInWithPassword({
      email: transientEmail,
      password: transientPassword,
    })
    if (error) throw new Error(`Transient sign-in failed: ${error.message}`)
  }

  async function deleteTransientUser(): Promise<void> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    // Profile cascades via auth.users ON DELETE CASCADE; family rows
    // created during the test are scoped per-test and cleaned up below.
    await fetch(`${supabaseUrl}/auth/v1/admin/users/${transientUserId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey },
    })
  }

  beforeEach(async () => {
    await createTransientUser()
  })

  afterEach(async () => {
    // Drop any family the transient user *created* so reruns don't
    // accumulate. Skip the seed family (which other tests share) when
    // the transient user merely joined it via invite code.
    const rows = (await runSQL(
      `SELECT family_id FROM profiles WHERE id = '${transientUserId}'`,
    )) as Array<{ family_id: string | null }>
    const fid = rows[0]?.family_id
    if (fid && fid !== familyId) {
      await runSQL(`DELETE FROM families WHERE id = '${fid}'`)
    }
    await transientClient?.auth.signOut()
    await deleteTransientUser()
  })

  it('create_family_as_parent: creates the family and elevates the caller to parent', async () => {
    const { data, error } = await transientClient.rpc('create_family_as_parent', {
      p_name: 'Test Parent Family',
    })
    expect(error).toBeNull()
    expect(typeof data).toBe('string')

    const rows = (await runSQL(
      `SELECT role, family_id FROM profiles WHERE id = '${transientUserId}'`,
    )) as Array<{ role: string; family_id: string }>
    expect(rows[0].role).toBe('parent')
    expect(rows[0].family_id).toBe(data)
  })

  it('create_family_as_parent: rejects empty family name', async () => {
    const { error } = await transientClient.rpc('create_family_as_parent', { p_name: '   ' })
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/family name required/i)
  })

  it('create_family_as_parent: rejects when the caller is already in a family', async () => {
    // First call succeeds.
    await transientClient.rpc('create_family_as_parent', { p_name: 'First Family' })
    // Second should fail.
    const { error } = await transientClient.rpc('create_family_as_parent', { p_name: 'Second Family' })
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/already in a family/i)
  })

  it('join_family_via_invite_code: joins the family and stays a child', async () => {
    // Look up the seed family's invite code.
    const codeRows = (await runSQL(
      `SELECT invite_code FROM families WHERE id = '${familyId}'`,
    )) as Array<{ invite_code: string }>
    const inviteCode = codeRows[0].invite_code

    const { data, error } = await transientClient.rpc('join_family_via_invite_code', {
      p_code: inviteCode,
    })
    expect(error).toBeNull()
    expect(data).toBe(familyId)

    const rows = (await runSQL(
      `SELECT role, family_id FROM profiles WHERE id = '${transientUserId}'`,
    )) as Array<{ role: string; family_id: string }>
    expect(rows[0].role).toBe('child')
    expect(rows[0].family_id).toBe(familyId)
  })

  it('join_family_via_invite_code: rejects an unknown code', async () => {
    const { error } = await transientClient.rpc('join_family_via_invite_code', {
      p_code: 'totally-not-a-real-code',
    })
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/invalid invite code/i)
  })
})
