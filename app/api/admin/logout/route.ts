import { NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE } from '@/lib/observability/constants'

export async function POST() {
  const response = NextResponse.json({ success: true })
  response.cookies.set(ADMIN_SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  })
  return response
}
