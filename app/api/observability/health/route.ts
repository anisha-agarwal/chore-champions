import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/observability/service-client'
import { validateAdminSession } from '@/lib/observability/admin-auth'
import { ADMIN_SESSION_COOKIE } from '@/lib/observability/constants'
import { cookies } from 'next/headers'

export async function GET() {
  // Require admin session
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value
  const isValid = sessionToken ? await validateAdminSession(sessionToken) : false

  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: {
    supabase: 'ok' | 'error'
    logging_pipeline: 'ok' | 'error'
    timestamp: string
  } = {
    supabase: 'error',
    logging_pipeline: 'error',
    timestamp: new Date().toISOString(),
  }

  // Supabase connectivity check
  try {
    const supabase = createServiceClient()
    const { error } = await supabase.from('app_errors').select('id').limit(1)
    if (!error) results.supabase = 'ok'
  } catch {
    // supabase remains 'error'
  }

  // Logging pipeline health: probe insert + immediate delete
  try {
    const supabase = createServiceClient()
    const { data: inserted, error: insertErr } = await supabase
      .from('app_events')
      .insert({ event_type: 'health_probe', metadata: {} })
      .select('id')
      .single()

    if (!insertErr && inserted) {
      await supabase.from('app_events').delete().eq('id', inserted.id)
      results.logging_pipeline = 'ok'
    }
  } catch {
    // logging_pipeline remains 'error'
  }

  return NextResponse.json(results)
}
