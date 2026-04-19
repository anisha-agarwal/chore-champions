/**
 * @jest-environment node
 */
jest.mock('@/lib/observability/middleware-timing', () => ({
  withObservability: (h: unknown) => h,
}))

const mockSendPushToUser = jest.fn()
jest.mock('@/lib/push/send', () => ({
  sendPushToUser: (...args: unknown[]) => mockSendPushToUser(...args),
}))

const mockGetUser = jest.fn()
const mockFrom = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: () =>
    Promise.resolve({
      auth: { getUser: () => mockGetUser() },
      from: (...args: unknown[]) => mockFrom(...args),
    }),
}))

import { POST } from '@/app/api/push/trigger/streak-milestone/route'
import { NextRequest } from 'next/server'

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/push/trigger/streak-milestone', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function selectChain(data: unknown) {
  const chain: Record<string, unknown> = {}
  chain.select = () => chain
  chain.eq = () => chain
  chain.single = () => Promise.resolve({ data, error: null })
  return chain
}

function parentListChain(data: unknown) {
  return {
    select: () => ({
      eq: () => ({
        eq: () => Promise.resolve({ data, error: null }),
      }),
    }),
  }
}

const PROFILE = { family_id: 'fam-1', display_name: 'Leo' }

beforeEach(() => {
  jest.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'child-1' } } })
  mockSendPushToUser.mockResolvedValue(1)
})

describe('POST /api/push/trigger/streak-milestone', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await POST(makeRequest({ days: 7 }))
    expect(res.status).toBe(401)
  })

  it('returns 400 on invalid JSON', async () => {
    const res = await POST(makeRequest('bad'))
    expect(res.status).toBe(400)
  })

  it('returns 400 when days is missing', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/days/)
  })

  it('returns 400 when days is negative', async () => {
    const res = await POST(makeRequest({ days: -1 }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when days is not a number', async () => {
    const res = await POST(makeRequest({ days: 'seven' }))
    expect(res.status).toBe(400)
  })

  it('returns 403 when user has no family', async () => {
    mockFrom.mockReturnValue(selectChain({ family_id: null, display_name: 'Leo' }))
    const res = await POST(makeRequest({ days: 7 }))
    expect(res.status).toBe(403)
  })

  it('returns 403 when profile is null', async () => {
    mockFrom.mockReturnValue(selectChain(null))
    const res = await POST(makeRequest({ days: 7 }))
    expect(res.status).toBe(403)
  })

  it('sends push to child and parents, returns counts', async () => {
    let callNum = 0
    mockFrom.mockImplementation(() => {
      callNum++
      if (callNum === 1) return selectChain(PROFILE)
      return parentListChain([{ id: 'parent-1' }, { id: 'parent-2' }])
    })

    const res = await POST(makeRequest({ days: 7, badge: 'Week Warrior' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.childSent).toBe(1)
    expect(body.parentSent).toBe(2)

    expect(mockSendPushToUser).toHaveBeenCalledTimes(3)
    expect(mockSendPushToUser).toHaveBeenCalledWith('child-1', expect.objectContaining({
      type: 'streak_milestone',
      title: 'Week Warrior!',
      body: 'Leo hit a 7-day streak',
    }))
    expect(mockSendPushToUser).toHaveBeenCalledWith('parent-1', expect.objectContaining({
      type: 'streak_milestone',
    }))
  })

  it('uses fallback badge label when badge is not provided', async () => {
    let callNum = 0
    mockFrom.mockImplementation(() => {
      callNum++
      if (callNum === 1) return selectChain(PROFILE)
      return parentListChain([])
    })

    await POST(makeRequest({ days: 14 }))
    expect(mockSendPushToUser).toHaveBeenCalledWith('child-1', expect.objectContaining({
      title: '14-day streak!',
    }))
  })

  it('handles no parents gracefully', async () => {
    let callNum = 0
    mockFrom.mockImplementation(() => {
      callNum++
      if (callNum === 1) return selectChain(PROFILE)
      return parentListChain([])
    })

    const res = await POST(makeRequest({ days: 7 }))
    const body = await res.json()
    expect(body.childSent).toBe(1)
    expect(body.parentSent).toBe(0)
  })

  it('handles null parents data', async () => {
    let callNum = 0
    mockFrom.mockImplementation(() => {
      callNum++
      if (callNum === 1) return selectChain(PROFILE)
      return parentListChain(null)
    })

    const res = await POST(makeRequest({ days: 7 }))
    const body = await res.json()
    expect(body.parentSent).toBe(0)
  })

  it('counts parentSent correctly when some parents have no subscriptions', async () => {
    let callNum = 0
    mockFrom.mockImplementation(() => {
      callNum++
      if (callNum === 1) return selectChain(PROFILE)
      return parentListChain([{ id: 'parent-1' }, { id: 'parent-2' }])
    })

    // First call (child) returns 1, parent-1 returns 1, parent-2 returns 0
    mockSendPushToUser
      .mockResolvedValueOnce(1) // child
      .mockResolvedValueOnce(1) // parent-1
      .mockResolvedValueOnce(0) // parent-2 (no subscriptions)

    const res = await POST(makeRequest({ days: 7 }))
    const body = await res.json()
    expect(body.parentSent).toBe(1) // only parent-1 counted
  })
})
