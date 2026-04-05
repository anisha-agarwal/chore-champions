/**
 * @jest-environment node
 */
jest.mock('@/lib/observability/middleware-timing', () => ({
  withObservability: (h: unknown) => h,
}))

import { GET } from '@/app/api/ai/chat/conversations/route'
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

/** Makes a Supabase query chain that is thenable and supports .single() */
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
  const url = new URL('http://localhost:3000/api/ai/chat/conversations')
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v)
    }
  }
  return new NextRequest(url.toString())
}

describe('GET /api/ai/chat/conversations', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.error).toBe('Unauthorized')
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

  it('returns conversations list with messageCount from array', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    const conversations = [
      { id: 'c-1', title: 'Chat 1', updated_at: '2024-01-15T10:00:00Z', messages: ['a', 'b', 'c'] },
      { id: 'c-2', title: null, updated_at: '2024-01-14T10:00:00Z', messages: 'not-array' },
    ]
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return makeChain({ family_id: 'fam-1', role: 'parent' })
      return makeChain(conversations)
    })
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(2)
    expect(body.data[0].messageCount).toBe(3)
    expect(body.data[1].messageCount).toBe(0) // non-array messages → 0
    expect(body.nextCursor).toBeNull()
  })

  it('returns nextCursor when there are more items', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    // Return limit+1 items (21 with default limit=20)
    const conversations = Array.from({ length: 21 }, (_, i) => ({
      id: `c-${i}`,
      title: `Chat ${i}`,
      updated_at: `2024-01-${String(15 - i).padStart(2, '0')}T10:00:00Z`,
      messages: [],
    }))
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return makeChain({ family_id: 'fam-1', role: 'parent' })
      return makeChain(conversations)
    })
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.data).toHaveLength(20) // sliced to limit
    expect(body.nextCursor).not.toBeNull()
  })

  it('applies cursor filter when cursor param is provided', async () => {
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
      return makeChain(null) // null data, no error → data ?? [] = []
    })
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
    expect(body.nextCursor).toBeNull()
  })
})
