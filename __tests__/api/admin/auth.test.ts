/**
 * @jest-environment node
 */
jest.mock('@/lib/observability/admin-auth', () => ({
  verifyAdminPassword: jest.fn(),
  createAdminSession: jest.fn(),
}))
jest.mock('@/lib/observability/service-client', () => ({
  createServiceClient: jest.fn(),
}))

import { POST } from '@/app/api/admin/auth/route'
import { NextRequest } from 'next/server'
import { verifyAdminPassword, createAdminSession } from '@/lib/observability/admin-auth'
import { createServiceClient } from '@/lib/observability/service-client'

const mockVerifyAdminPassword = verifyAdminPassword as jest.Mock
const mockCreateAdminSession = createAdminSession as jest.Mock
const mockCreateServiceClient = createServiceClient as jest.Mock

function makeRequest(body: unknown, ip?: string): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (ip) headers['x-forwarded-for'] = ip
  return new NextRequest('http://localhost/api/admin/auth', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

function setupSupabaseRateLimit(count: number) {
  mockCreateServiceClient.mockReturnValue({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          gte: jest.fn().mockResolvedValue({ count, error: null }),
        }),
      }),
      insert: jest.fn().mockResolvedValue({ error: null }),
    }),
  })
}

describe('POST /api/admin/auth', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCreateAdminSession.mockResolvedValue('valid-session-token')
    process.env.ADMIN_SESSION_SECRET = 'a'.repeat(64)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new NextRequest('http://localhost/api/admin/auth', {
      method: 'POST',
      body: 'not-json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 429 when rate limited', async () => {
    setupSupabaseRateLimit(5) // at limit
    const req = makeRequest({ password: 'test' }, '1.2.3.4')
    const res = await POST(req)
    expect(res.status).toBe(429)
  })

  it('returns 401 for wrong password', async () => {
    setupSupabaseRateLimit(0)
    mockVerifyAdminPassword.mockReturnValue(false)

    const req = makeRequest({ password: 'wrong' }, '1.2.3.4')
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 200 and sets cookie for correct password', async () => {
    setupSupabaseRateLimit(0)
    mockVerifyAdminPassword.mockReturnValue(true)

    const req = makeRequest({ password: 'correct' }, '1.2.3.4')
    const res = await POST(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(true)

    const setCookie = res.headers.get('set-cookie')
    expect(setCookie).toContain('admin_obs_session')
  })

  it('returns 500 when session creation fails', async () => {
    setupSupabaseRateLimit(0)
    mockVerifyAdminPassword.mockReturnValue(true)
    mockCreateAdminSession.mockRejectedValue(new Error('crypto error'))

    const req = makeRequest({ password: 'correct' }, '1.2.3.4')
    const res = await POST(req)
    expect(res.status).toBe(500)
  })

  it('handles missing IP gracefully', async () => {
    setupSupabaseRateLimit(0)
    mockVerifyAdminPassword.mockReturnValue(true)

    const req = makeRequest({ password: 'correct' })
    const res = await POST(req)
    expect(res.status).toBe(200)
  })

  it('allows when rate limit check throws', async () => {
    mockCreateServiceClient.mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockRejectedValue(new Error('DB error')),
          }),
        }),
        insert: jest.fn().mockResolvedValue({ error: null }),
      }),
    })
    mockVerifyAdminPassword.mockReturnValue(true)

    const req = makeRequest({ password: 'correct' }, '5.6.7.8')
    const res = await POST(req)
    expect(res.status).toBe(200)
  })
})
