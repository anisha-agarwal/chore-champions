import { SUPABASE_PROJECT_REF } from './test-constants'

/**
 * Executes SQL via the Supabase Management API (superuser, bypasses RLS).
 * Used for test data setup and cleanup.
 */
export async function runSQL(query: string): Promise<unknown[]> {
  const token = process.env.SUPABASE_ACCESS_TOKEN
  if (!token) throw new Error('SUPABASE_ACCESS_TOKEN not set in .env.local')

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`SQL query failed (${res.status}): ${text}`)
  }

  return (await res.json()) as unknown[]
}

/**
 * Creates a Supabase Auth user via the GoTrue Admin API, or returns the
 * existing user's ID if the email already exists. Sets email_confirm: true
 * to bypass email verification.
 */
export async function ensureAuthUser(
  email: string,
  password: string,
  displayName: string
): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required')
  }

  // Check if user already exists
  const existing = await runSQL(
    `SELECT id FROM auth.users WHERE email = '${email}' LIMIT 1`
  ) as Array<{ id: string }>

  if (existing.length > 0) return existing[0].id

  // Create via GoTrue Admin API
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

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to create user ${email}: ${text}`)
  }

  const data = (await res.json()) as { id: string }
  return data.id
}
