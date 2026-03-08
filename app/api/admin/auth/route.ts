import { NextResponse, type NextRequest } from 'next/server'
import { verifyAdminPassword, createAdminSession } from '@/lib/observability/admin-auth'
import { createServiceClient } from '@/lib/observability/service-client'
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_DURATION_HOURS,
  ADMIN_RATE_LIMIT_MAX_ATTEMPTS,
  ADMIN_RATE_LIMIT_WINDOW_MINUTES,
} from '@/lib/observability/constants'

async function hashIp(ip: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(ip + (process.env.ADMIN_SESSION_SECRET ?? ''))
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Buffer.from(hashBuffer).toString('hex').slice(0, 32)
}

async function checkRateLimit(ipHash: string): Promise<boolean> {
  try {
    const supabase = createServiceClient()
    const windowStart = new Date(Date.now() - ADMIN_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString()

    const { count } = await supabase
      .from('admin_auth_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gte('attempted_at', windowStart)

    return (count ?? 0) < ADMIN_RATE_LIMIT_MAX_ATTEMPTS
  } catch {
    // If rate limit check fails, allow the attempt
    return true
  }
}

async function recordAttempt(ipHash: string): Promise<void> {
  try {
    const supabase = createServiceClient()
    await supabase.from('admin_auth_attempts').insert({ ip_hash: ipHash })
  } catch {
    // Ignore
  }
}

export async function POST(request: NextRequest) {
  let body: { password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const ipHash = await hashIp(ip)

  // Rate limit check
  const allowed = await checkRateLimit(ipHash)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
  }

  // Record attempt before verification
  await recordAttempt(ipHash)

  if (!body.password || !verifyAdminPassword(body.password)) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  // Create session
  let token: string
  try {
    token = await createAdminSession()
  } catch {
    return NextResponse.json({ error: 'Session creation failed' }, { status: 500 })
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: ADMIN_SESSION_DURATION_HOURS * 60 * 60,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  })

  return response
}
