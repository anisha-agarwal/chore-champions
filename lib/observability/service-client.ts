import { createClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client for server-side observability writes.
 * Bypasses RLS. Never used in client components.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { persistSession: false } })
}
