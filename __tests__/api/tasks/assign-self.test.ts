/**
 * @jest-environment node
 */
jest.mock('@/lib/observability/middleware-timing', () => ({
  withObservability: (h: unknown) => h,
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

import { POST } from '@/app/api/tasks/assign-self/route'
import { NextRequest } from 'next/server'

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/tasks/assign-self', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function selectChain(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {}
  chain.select = () => chain
  chain.eq = () => chain
  chain.single = () => Promise.resolve({ data, error })
  return chain
}

const TASK = {
  id: 'task-1',
  family_id: 'fam-1',
  assigned_to: null,
  completed: false,
}

const PROFILE = { family_id: 'fam-1' }

beforeEach(() => {
  jest.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'child-1' } } })
})

describe('POST /api/tasks/assign-self', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await POST(makeRequest({ taskId: 'task-1' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 on invalid JSON', async () => {
    const res = await POST(makeRequest('not-json'))
    expect(res.status).toBe(400)
  })

  it('returns 400 when taskId is missing', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
  })

  it('returns 400 when taskId is not a string', async () => {
    const res = await POST(makeRequest({ taskId: 42 }))
    expect(res.status).toBe(400)
  })

  it('returns 403 when user has no family', async () => {
    mockFrom.mockReturnValue(selectChain({ family_id: null }))
    const res = await POST(makeRequest({ taskId: 'task-1' }))
    expect(res.status).toBe(403)
  })

  it('returns 403 when profile is null', async () => {
    mockFrom.mockReturnValue(selectChain(null))
    const res = await POST(makeRequest({ taskId: 'task-1' }))
    expect(res.status).toBe(403)
  })

  it('returns 404 when task not found', async () => {
    let call = 0
    mockFrom.mockImplementation(() => {
      call++
      if (call === 1) return selectChain(PROFILE)
      return selectChain(null)
    })
    const res = await POST(makeRequest({ taskId: 'nope' }))
    expect(res.status).toBe(404)
  })

  it('returns 403 when task is in a different family', async () => {
    let call = 0
    mockFrom.mockImplementation(() => {
      call++
      if (call === 1) return selectChain(PROFILE)
      return selectChain({ ...TASK, family_id: 'other-fam' })
    })
    const res = await POST(makeRequest({ taskId: 'task-1' }))
    expect(res.status).toBe(403)
  })

  it('returns 409 when task is already assigned', async () => {
    let call = 0
    mockFrom.mockImplementation(() => {
      call++
      if (call === 1) return selectChain(PROFILE)
      return selectChain({ ...TASK, assigned_to: 'other-child' })
    })
    const res = await POST(makeRequest({ taskId: 'task-1' }))
    expect(res.status).toBe(409)
  })

  it('returns 409 when task is already completed', async () => {
    let call = 0
    mockFrom.mockImplementation(() => {
      call++
      if (call === 1) return selectChain(PROFILE)
      return selectChain({ ...TASK, completed: true })
    })
    const res = await POST(makeRequest({ taskId: 'task-1' }))
    expect(res.status).toBe(409)
  })

  it('assigns the task to the user with self_assigned=true', async () => {
    const updateSpy = jest.fn(() => ({ eq: () => Promise.resolve({ error: null }) }))
    let call = 0
    mockFrom.mockImplementation(() => {
      call++
      if (call === 1) return selectChain(PROFILE)
      if (call === 2) return selectChain(TASK)
      return { update: updateSpy }
    })
    const res = await POST(makeRequest({ taskId: 'task-1' }))
    expect(res.status).toBe(200)
    expect(updateSpy).toHaveBeenCalledWith({ assigned_to: 'child-1', self_assigned: true })
  })

  it('returns 500 when the update fails', async () => {
    let call = 0
    mockFrom.mockImplementation(() => {
      call++
      if (call === 1) return selectChain(PROFILE)
      if (call === 2) return selectChain(TASK)
      return {
        update: () => ({ eq: () => Promise.resolve({ error: { message: 'DB error' } }) }),
      }
    })
    const res = await POST(makeRequest({ taskId: 'task-1' }))
    expect(res.status).toBe(500)
  })
})
