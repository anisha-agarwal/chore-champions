/**
 * @jest-environment node
 */
jest.mock('@/lib/observability/middleware-timing', () => ({
  withObservability: (h: unknown) => h,
}))

import { GET } from '@/app/api/ai/chat/conversations/[id]/route'
import { NextRequest } from 'next/server'

const mockGetUser = jest.fn()
const mockFrom = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: () =>
    Promise.resolve({
      auth: { getUser: () => mockGetUser() },
      from: (...args: unknown[]) => mockFrom(...args),
    }),
}))

function makeChain(data: unknown, error: unknown = null) {
  const result = { data, error: error ?? null }
  const chain: Record<string, unknown> = {
    then: (res: (v: unknown) => void, rej?: (e: unknown) => void) =>
      Promise.resolve(result).then(res, rej),
    select: () => chain,
    eq: () => chain,
    single: () => Promise.resolve(result),
  }
  return chain
}

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/ai/chat/conversations/conv-1')
}

const context = { params: { id: 'conv-1' } }

describe('GET /api/ai/chat/conversations/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await GET(makeRequest(), context)
    expect(res.status).toBe(401)
  })

  it('returns 403 when profile is null', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockFrom.mockReturnValue(makeChain(null))
    const res = await GET(makeRequest(), context)
    expect(res.status).toBe(403)
  })

  it('returns 403 when user is not a parent', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockFrom.mockReturnValue(makeChain({ role: 'child' }))
    const res = await GET(makeRequest(), context)
    expect(res.status).toBe(403)
  })

  it('returns 404 when conversation not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return makeChain({ role: 'parent' })
      return makeChain(null, { message: 'Not found' })
    })
    const res = await GET(makeRequest(), context)
    expect(res.status).toBe(404)
  })

  it('returns conversation data when found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    const conv = { id: 'conv-1', messages: [], title: 'Test', family_id: 'fam-1' }
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return makeChain({ role: 'parent' })
      return makeChain(conv)
    })
    const res = await GET(makeRequest(), context)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toMatchObject({ id: 'conv-1' })
  })
})
