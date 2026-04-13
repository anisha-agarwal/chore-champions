/**
 * @jest-environment node
 */
jest.mock('@/lib/observability/middleware-timing', () => ({
  withObservability: (h: unknown) => h,
}))

import { POST } from '@/app/api/push/unsubscribe/route'
import { NextRequest } from 'next/server'

const mockGetUser = jest.fn()
const mockDelete = jest.fn()
const mockEq = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: () =>
    Promise.resolve({
      auth: { getUser: () => mockGetUser() },
      from: () => ({
        delete: () => ({
          eq: (...args: unknown[]) => {
            mockEq(...args)
            return {
              eq: (...args2: unknown[]) => {
                mockDelete(...args2)
                return Promise.resolve({ error: null })
              },
            }
          },
        }),
      }),
    }),
}))

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/push/unsubscribe', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
})

describe('POST /api/push/unsubscribe', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await POST(makeRequest({ endpoint: 'https://x.com' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when body is not valid JSON', async () => {
    const res = await POST(makeRequest('not json'))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Invalid JSON')
  })

  it('returns 400 when endpoint is missing', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/endpoint/)
  })

  it('returns 400 when endpoint is not a string', async () => {
    const res = await POST(makeRequest({ endpoint: 42 }))
    expect(res.status).toBe(400)
  })

  it('deletes subscription and returns 200', async () => {
    const res = await POST(makeRequest({ endpoint: 'https://push.example.com/sub-1' }))
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(mockDelete).toHaveBeenCalledWith('endpoint', 'https://push.example.com/sub-1')
  })
})
