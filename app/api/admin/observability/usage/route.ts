import { NextResponse, type NextRequest } from 'next/server'
import { validateAdminSession } from '@/lib/observability/admin-auth'
import { createServiceClient } from '@/lib/observability/service-client'
import { ADMIN_SESSION_COOKIE } from '@/lib/observability/constants'
import { cookies } from 'next/headers'
import type { UsageAnalytics } from '@/lib/types'

function rangeToDays(range: string | null): number {
  if (range === '30d') return 30
  if (range === '90d') return 90
  return 7 // default: 7d
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value
  const isValid = sessionToken ? await validateAdminSession(sessionToken) : false

  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const range = new URL(request.url).searchParams.get('range')
  const days = rangeToDays(range)

  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('get_usage_analytics', {
    p_range_days: days,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data as UsageAnalytics)
}
