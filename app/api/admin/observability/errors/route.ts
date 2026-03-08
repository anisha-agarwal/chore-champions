import { NextResponse, type NextRequest } from 'next/server'
import { validateAdminSession } from '@/lib/observability/admin-auth'
import { createServiceClient } from '@/lib/observability/service-client'
import { ADMIN_SESSION_COOKIE } from '@/lib/observability/constants'
import { cookies } from 'next/headers'
import type { ErrorListResult } from '@/lib/types'

function rangeToHours(range: string | null): number {
  if (range === '7d') return 168
  if (range === '30d') return 720
  return 24
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value
  const isValid = sessionToken ? await validateAdminSession(sessionToken) : false

  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
  const type = searchParams.get('type') ?? null
  const range = searchParams.get('range')
  const hours = rangeToHours(range)
  const offset = (page - 1) * limit

  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('get_recent_errors', {
    p_limit: limit,
    p_offset: offset,
    p_type: type,
    p_range_hours: hours,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data as ErrorListResult)
}
