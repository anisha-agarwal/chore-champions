/**
 * DB integration test for handle_new_user trigger.
 *
 * Regression: signup metadata was previously trusted for role, letting any
 * user sign up as parent via supabase.auth.signUp({ options: { data: { role: 'parent' }}}).
 * Migration 019 forces role to 'child' regardless of metadata.
 */
import { runSQL } from '../../e2e/supabase-admin'

const TEST_EMAIL = `db-test-signup-role-${Date.now()}@chore-champions-test.local`
const TEST_PASSWORD = 'TestPassword123!'

async function createAuthUserWithMetadata(
  email: string,
  password: string,
  userMetadata: Record<string, unknown>,
): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required')
  }
  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: userMetadata,
    }),
  })
  if (!res.ok) throw new Error(`Failed to create user: ${await res.text()}`)
  const data = (await res.json()) as { id: string }
  return data.id
}

async function deleteAuthUser(userId: string): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey },
  })
}

describe('handle_new_user trigger (migration 019)', () => {
  let userId: string | null = null

  afterEach(async () => {
    if (userId) {
      await deleteAuthUser(userId)
      userId = null
    }
  })

  it('forces role to child even when signup metadata asks for parent', async () => {
    userId = await createAuthUserWithMetadata(TEST_EMAIL, TEST_PASSWORD, {
      display_name: 'Attacker',
      role: 'parent',
    })

    const rows = (await runSQL(
      `SELECT role, display_name FROM profiles WHERE id = '${userId}'`,
    )) as Array<{ role: string; display_name: string }>

    expect(rows).toHaveLength(1)
    expect(rows[0].role).toBe('child')
    expect(rows[0].display_name).toBe('Attacker')
  })

  it('still honors display_name and avatar_url from metadata', async () => {
    userId = await createAuthUserWithMetadata(
      `db-test-signup-meta-${Date.now()}@chore-champions-test.local`,
      TEST_PASSWORD,
      {
        display_name: 'Legit User',
        avatar_url: 'https://example.com/a.png',
      },
    )

    const rows = (await runSQL(
      `SELECT role, display_name, avatar_url FROM profiles WHERE id = '${userId}'`,
    )) as Array<{ role: string; display_name: string; avatar_url: string | null }>

    expect(rows[0].role).toBe('child')
    expect(rows[0].display_name).toBe('Legit User')
    expect(rows[0].avatar_url).toBe('https://example.com/a.png')
  })
})
