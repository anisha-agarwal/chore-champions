import { NextResponse } from 'next/server'
import { validateAdminSession } from '@/lib/observability/admin-auth'
import { runCleanup } from '@/lib/observability/cleanup'
import { ADMIN_SESSION_COOKIE } from '@/lib/observability/constants'
import { cookies } from 'next/headers'

export async function POST() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value
  const isValid = sessionToken ? await validateAdminSession(sessionToken) : false

  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runCleanup(90)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Cleanup failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
