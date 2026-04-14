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

const mockServiceFrom = jest.fn()
jest.mock('@/lib/observability/service-client', () => ({
  createServiceClient: () => ({ from: (...args: unknown[]) => mockServiceFrom(...args) }),
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

import { POST } from '@/app/api/tasks/complete/route'
import { NextRequest } from 'next/server'

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/tasks/complete', {
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

function updateChain(error: unknown = null) {
  return {
    update: () => ({
      eq: () => Promise.resolve({ error }),
    }),
  }
}

function insertChain(error: unknown = null) {
  return {
    insert: () => Promise.resolve({ error }),
  }
}

const TASK = {
  id: 'task-1',
  title: 'Take out trash',
  points: 10,
  recurring: null,
  due_time: null,
  due_date: null,
  family_id: 'fam-1',
  completed: false,
}

const PROFILE = { family_id: 'fam-1' }

beforeEach(() => {
  jest.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'child-1' } } })
  mockSendPushToUser.mockResolvedValue(1)
})

describe('POST /api/tasks/complete', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await POST(makeRequest({ taskId: 'task-1' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 on invalid JSON', async () => {
    const res = await POST(makeRequest('bad'))
    expect(res.status).toBe(400)
  })

  it('returns 400 when taskId is missing', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
  })

  it('returns 400 when taskId is not a string', async () => {
    const res = await POST(makeRequest({ taskId: 123 }))
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

  it('returns 409 when non-recurring task is already completed', async () => {
    let call = 0
    mockFrom.mockImplementation(() => {
      call++
      if (call === 1) return selectChain(PROFILE)
      return selectChain({ ...TASK, completed: true })
    })
    const res = await POST(makeRequest({ taskId: 'task-1' }))
    expect(res.status).toBe(409)
  })

  it('completes non-recurring task, inserts completion, returns points', async () => {
    let call = 0
    mockFrom.mockImplementation((table: string) => {
      call++
      if (call === 1) return selectChain(PROFILE)
      if (call === 2) return selectChain(TASK)
      if (call === 3) return updateChain()
      if (call === 4) return insertChain()
      return selectChain(null)
    })

    const res = await POST(makeRequest({ taskId: 'task-1' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.pointsEarned).toBe(10)
    expect(body.taskTitle).toBe('Take out trash')
  })

  it('does not mark recurring task as completed on the task row', async () => {
    const recurringTask = { ...TASK, recurring: 'daily' }
    let call = 0
    const updateFn = jest.fn()
    mockFrom.mockImplementation((table: string) => {
      call++
      if (call === 1) return selectChain(PROFILE)
      if (call === 2) return selectChain(recurringTask)
      // call 3 should be insert (no update for recurring)
      return { insert: () => Promise.resolve({ error: null }) }
    })

    const res = await POST(makeRequest({ taskId: 'task-1', selectedDate: '2026-04-13' }))
    expect(res.status).toBe(200)
  })

  it('returns 500 when task update fails', async () => {
    let call = 0
    mockFrom.mockImplementation(() => {
      call++
      if (call === 1) return selectChain(PROFILE)
      if (call === 2) return selectChain(TASK)
      return updateChain({ message: 'DB error' })
    })
    const res = await POST(makeRequest({ taskId: 'task-1' }))
    expect(res.status).toBe(500)
  })

  it('returns 500 when completion insert fails', async () => {
    let call = 0
    mockFrom.mockImplementation(() => {
      call++
      if (call === 1) return selectChain(PROFILE)
      if (call === 2) return selectChain(TASK)
      if (call === 3) return updateChain()
      return insertChain({ message: 'insert error' })
    })
    const res = await POST(makeRequest({ taskId: 'task-1' }))
    expect(res.status).toBe(500)
  })

  it('calculates half points when task is overdue', async () => {
    const overdueTask = {
      ...TASK,
      due_time: '08:00:00',
      due_date: '2020-01-01',
    }
    let call = 0
    mockFrom.mockImplementation(() => {
      call++
      if (call === 1) return selectChain(PROFILE)
      if (call === 2) return selectChain(overdueTask)
      if (call === 3) return updateChain()
      return insertChain()
    })

    const res = await POST(makeRequest({ taskId: 'task-1' }))
    const body = await res.json()
    expect(body.pointsEarned).toBe(5)
  })

  it('calculates half points for overdue recurring task using selectedDate', async () => {
    const recurringOverdue = {
      ...TASK,
      recurring: 'daily',
      due_time: '08:00:00',
    }
    let call = 0
    mockFrom.mockImplementation(() => {
      call++
      if (call === 1) return selectChain(PROFILE)
      if (call === 2) return selectChain(recurringOverdue)
      return insertChain()
    })

    const res = await POST(makeRequest({ taskId: 'task-1', selectedDate: '2020-01-01' }))
    const body = await res.json()
    expect(body.pointsEarned).toBe(5)
  })

  it('awards full points when task has due_time but is not overdue', async () => {
    const futureTask = {
      ...TASK,
      due_time: '23:59:00',
      due_date: '2099-12-31',
    }
    let call = 0
    mockFrom.mockImplementation(() => {
      call++
      if (call === 1) return selectChain(PROFILE)
      if (call === 2) return selectChain(futureTask)
      if (call === 3) return updateChain()
      return insertChain()
    })

    const res = await POST(makeRequest({ taskId: 'task-1' }))
    const body = await res.json()
    expect(body.pointsEarned).toBe(10)
  })

  it('awards full points when no due_time', async () => {
    let call = 0
    mockFrom.mockImplementation(() => {
      call++
      if (call === 1) return selectChain(PROFILE)
      if (call === 2) return selectChain(TASK)
      if (call === 3) return updateChain()
      return insertChain()
    })

    const res = await POST(makeRequest({ taskId: 'task-1' }))
    const body = await res.json()
    expect(body.pointsEarned).toBe(10)
  })

  it('awards full points when due_time exists but no dateStr resolves', async () => {
    const taskNoDueDate = { ...TASK, due_time: '08:00:00', due_date: null }
    let call = 0
    mockFrom.mockImplementation(() => {
      call++
      if (call === 1) return selectChain(PROFILE)
      if (call === 2) return selectChain(taskNoDueDate)
      if (call === 3) return updateChain()
      return insertChain()
    })

    const res = await POST(makeRequest({ taskId: 'task-1' }))
    const body = await res.json()
    expect(body.pointsEarned).toBe(10)
  })
})

describe('notifyParents (fire-and-forget)', () => {
  it('sends push to parents in the family', async () => {
    let call = 0
    mockFrom.mockImplementation(() => {
      call++
      if (call === 1) return selectChain(PROFILE)
      if (call === 2) return selectChain(TASK)
      if (call === 3) return updateChain()
      return insertChain()
    })

    let serviceCall = 0
    mockServiceFrom.mockImplementation(() => {
      serviceCall++
      if (serviceCall === 1) {
        // parents query: .select('id').eq('family_id', ...).eq('role', 'parent')
        return {
          select: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ data: [{ id: 'parent-1' }, { id: 'parent-2' }] }),
            }),
          }),
        }
      }
      // child profile: .select('display_name').eq('id', ...).single()
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: { display_name: 'Leo' } }),
          }),
        }),
      }
    })

    await POST(makeRequest({ taskId: 'task-1' }))
    await new Promise((r) => setTimeout(r, 50))

    expect(mockSendPushToUser).toHaveBeenCalledTimes(2)
    expect(mockSendPushToUser).toHaveBeenCalledWith('parent-1', expect.objectContaining({
      type: 'task_completed',
      title: 'Leo completed a task',
    }))
  })

  it('does not fail the response when push throws', async () => {
    let call = 0
    mockFrom.mockImplementation(() => {
      call++
      if (call === 1) return selectChain(PROFILE)
      if (call === 2) return selectChain(TASK)
      if (call === 3) return updateChain()
      return insertChain()
    })

    mockServiceFrom.mockImplementation(() => {
      throw new Error('service crash')
    })

    const res = await POST(makeRequest({ taskId: 'task-1' }))
    expect(res.status).toBe(200)
  })

  it('uses fallback name when child profile not found', async () => {
    let call = 0
    mockFrom.mockImplementation(() => {
      call++
      if (call === 1) return selectChain(PROFILE)
      if (call === 2) return selectChain(TASK)
      if (call === 3) return updateChain()
      return insertChain()
    })

    let serviceCall = 0
    mockServiceFrom.mockImplementation(() => {
      serviceCall++
      if (serviceCall === 1) {
        return {
          select: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ data: [{ id: 'parent-1' }] }),
            }),
          }),
        }
      }
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null }),
          }),
        }),
      }
    })

    await POST(makeRequest({ taskId: 'task-1' }))
    await new Promise((r) => setTimeout(r, 50))

    expect(mockSendPushToUser).toHaveBeenCalledWith('parent-1', expect.objectContaining({
      title: 'Your child completed a task',
    }))
  })

  it('does nothing when no parents found', async () => {
    let call = 0
    mockFrom.mockImplementation(() => {
      call++
      if (call === 1) return selectChain(PROFILE)
      if (call === 2) return selectChain(TASK)
      if (call === 3) return updateChain()
      return insertChain()
    })

    mockServiceFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          eq: () => Promise.resolve({ data: null }),
        }),
      }),
    }))

    await POST(makeRequest({ taskId: 'task-1' }))
    await new Promise((r) => setTimeout(r, 50))

    expect(mockSendPushToUser).not.toHaveBeenCalled()
  })
})
