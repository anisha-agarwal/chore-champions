/**
 * @jest-environment node
 */
jest.mock('@/lib/observability/middleware-timing', () => ({
  withObservability: (h: unknown) => h,
}))

import { POST } from '@/app/api/push/subscribe/route'
import { NextRequest } from 'next/server'

const mockGetUser = jest.fn()
const mockUpsert = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: () =>
    Promise.resolve({
      auth: { getUser: () => mockGetUser() },
      from: () => ({ upsert: (...args: unknown[]) => mockUpsert(...args) }),
    }),
}))

function makeRequest(body: unknown, headers?: Record<string, string>): NextRequest {
  return new NextRequest('http://localhost:3000/api/push/subscribe', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'TestBrowser/1.0',
      ...headers,
    },
  })
}

const VALID_BODY = {
  endpoint: 'https://push.example.com/sub-1',
  p256dh_key: 'pk-value',
  auth_key: 'ak-value',
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  mockUpsert.mockResolvedValue({ error: null })
})

describe('POST /api/push/subscribe', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(401)
  })

  it('returns 400 when body is not valid JSON', async () => {
    const res = await POST(makeRequest('not json'))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Invalid JSON')
  })

  it('returns 400 when endpoint is missing', async () => {
    const res = await POST(makeRequest({ p256dh_key: 'pk', auth_key: 'ak' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/endpoint/)
  })

  it('returns 400 when endpoint is not a string', async () => {
    const res = await POST(makeRequest({ endpoint: 42, p256dh_key: 'pk', auth_key: 'ak' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when p256dh_key is missing', async () => {
    const res = await POST(makeRequest({ endpoint: 'https://x.com', auth_key: 'ak' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/p256dh_key/)
  })

  it('returns 400 when p256dh_key is not a string', async () => {
    const res = await POST(makeRequest({ endpoint: 'https://x.com', p256dh_key: 123, auth_key: 'ak' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when auth_key is missing', async () => {
    const res = await POST(makeRequest({ endpoint: 'https://x.com', p256dh_key: 'pk' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/auth_key/)
  })

  it('returns 400 when auth_key is not a string', async () => {
    const res = await POST(makeRequest({ endpoint: 'https://x.com', p256dh_key: 'pk', auth_key: false }))
    expect(res.status).toBe(400)
  })

  it('upserts subscription and returns 200', async () => {
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        endpoint: VALID_BODY.endpoint,
        p256dh_key: VALID_BODY.p256dh_key,
        auth_key: VALID_BODY.auth_key,
        user_agent: 'TestBrowser/1.0',
      }),
      { onConflict: 'user_id,endpoint' },
    )
  })

  it('passes undefined user_agent when header is absent', async () => {
    const req = new NextRequest('http://localhost:3000/api/push/subscribe', {
      method: 'POST',
      body: JSON.stringify(VALID_BODY),
    })
    await POST(req)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_agent: undefined }),
      expect.anything(),
    )
  })

  it('returns 500 when upsert fails', async () => {
    mockUpsert.mockResolvedValue({ error: { message: 'DB error' } })
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(500)
  })
})
