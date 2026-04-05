/**
 * @jest-environment node
 */
jest.mock('@/lib/observability/middleware-timing', () => ({
  withObservability: (h: unknown) => h,
}))

import { GET } from '@/app/api/ai/quest-buddy/history/route'
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
    lt: () => chain,
    order: () => chain,
    limit: () => chain,
    single: () => Promise.resolve(result),
  }
  return chain
}

function makeRequest(params?: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/api/ai/quest-buddy/history')
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v)
    }
  }
  return new NextRequest(url.toString())
}

describe('GET /api/ai/quest-buddy/history', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('returns 403 when profile is null', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockFrom.mockReturnValue(makeChain(null))
    const res = await GET(makeRequest())
    expect(res.status).toBe(403)
  })

  it('returns 403 when user is not a parent', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockFrom.mockReturnValue(makeChain({ family_id: 'fam-1', role: 'child' }))
    const res = await GET(makeRequest())
    expect(res.status).toBe(403)
  })

  it('returns 500 when database query errors', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return makeChain({ family_id: 'fam-1', role: 'parent' })
      return makeChain(null, { message: 'DB error' })
    })
    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
  })

  it('returns kid chats with messageCount and childName', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    const chats = [
      {
        id: 'chat-1',
        child_id: 'child-1',
        messages: ['a', 'b'],
        created_at: '2024-01-15T10:00:00Z',
        profiles: { display_name: 'Timmy' },
      },
      {
        id: 'chat-2',
        child_id: 'child-2',
        messages: 'not-array',
        created_at: '2024-01-14T10:00:00Z',
        profiles: null,
      },
    ]
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return makeChain({ family_id: 'fam-1', role: 'parent' })
      return makeChain(chats)
    })
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(2)
    expect(body.data[0].messageCount).toBe(2)
    expect(body.data[0].childName).toBe('Timmy')
    expect(body.data[1].messageCount).toBe(0) // non-array
    expect(body.data[1].childName).toBe('Unknown') // null profile
    expect(body.nextCursor).toBeNull()
  })

  it('applies childId filter when provided', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return makeChain({ family_id: 'fam-1', role: 'parent' })
      return makeChain([])
    })
    const res = await GET(makeRequest({ childId: 'child-1' }))
    expect(res.status).toBe(200)
  })

  it('applies cursor filter when provided', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return makeChain({ family_id: 'fam-1', role: 'parent' })
      return makeChain([])
    })
    const res = await GET(makeRequest({ cursor: '2024-01-10T00:00:00Z' }))
    expect(res.status).toBe(200)
  })

  it('handles null data from query (uses empty array fallback)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return makeChain({ family_id: 'fam-1', role: 'parent' })
      return makeChain(null) // null data, no error
    })
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
    expect(body.nextCursor).toBeNull()
  })

  it('returns nextCursor when there are more items than the limit', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    const chats = Array.from({ length: 21 }, (_, i) => ({
      id: `chat-${i}`,
      child_id: 'child-1',
      messages: [],
      created_at: `2024-01-${String(15 - i).padStart(2, '0')}T10:00:00Z`,
      profiles: { display_name: 'Kid' },
    }))
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return makeChain({ family_id: 'fam-1', role: 'parent' })
      return makeChain(chats)
    })
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.data).toHaveLength(20)
    expect(body.nextCursor).not.toBeNull()
  })
})
