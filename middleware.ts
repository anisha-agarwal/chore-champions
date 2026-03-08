import { updateSession } from '@/lib/supabase/middleware'
import { validateAdminSession } from '@/lib/observability/admin-auth'
import { ADMIN_SESSION_COOKIE } from '@/lib/observability/constants'
import { NextResponse, NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Add request start timestamp for API route latency measurement
  const headers = new Headers(request.headers)
  headers.set('x-request-start-ms', Date.now().toString())
  const requestWithTiming = new NextRequest(request, { headers })

  // Admin observability route protection (excluding login page)
  if (
    pathname.startsWith('/admin/observability') &&
    !pathname.startsWith('/admin/observability/login')
  ) {
    const sessionToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value
    const isValid = sessionToken ? await validateAdminSession(sessionToken) : false

    if (!isValid) {
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/admin/observability/login'
      return NextResponse.redirect(loginUrl)
    }
  }

  return await updateSession(requestWithTiming)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|avatars/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
