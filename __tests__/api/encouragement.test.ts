/**
 * @jest-environment node
 */
import { POST } from '@/app/api/ai/encouragement/route'

// Mock Supabase server client
const mockGetUser = jest.fn()
jest.mock('@/lib/supabase/server', () => ({
  createClient: () => Promise.resolve({
    auth: {
      getUser: () => mockGetUser(),
    },
  }),
}))

// Store original fetch
const originalFetch = global.fetch

describe('POST /api/ai/encouragement', () => {
  const validContext = {
    taskTitle: 'Clean Room',
    pointsEarned: 10,
    totalPoints: 50,
    completionsToday: 2,
    totalTasksToday: 5,
    timeOfDay: 'morning',
    userName: 'Timmy',
    isOverdue: false,
    isMilestone: false,
    milestoneType: null,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.ANTHROPIC_API_KEY = 'test-api-key'
  })

  afterEach(() => {
    global.fetch = originalFetch
    delete process.env.ANTHROPIC_API_KEY
  })

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const request = new Request('http://localhost:3000/api/ai/encouragement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validContext),
    })

    const response = await POST(request)
    expect(response.status).toBe(401)

    const data = await response.json()
    expect(data.error).toBe('Unauthorized')
  })

  it('returns AI message on successful API call', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        content: [{ text: 'Amazing job cleaning your room, Timmy!' }],
      }),
    })

    const request = new Request('http://localhost:3000/api/ai/encouragement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validContext),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.message).toBe('Amazing job cleaning your room, Timmy!')
    expect(data.isMilestone).toBe(false)
  })

  it('returns { message: null } when ANTHROPIC_API_KEY is missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    delete process.env.ANTHROPIC_API_KEY

    const request = new Request('http://localhost:3000/api/ai/encouragement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validContext),
    })

    const response = await POST(request)
    const data = await response.json()
    expect(data.message).toBeNull()
  })

  it('returns { message: null } when Anthropic API returns non-ok response', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
    })

    const request = new Request('http://localhost:3000/api/ai/encouragement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validContext),
    })

    const response = await POST(request)
    const data = await response.json()
    expect(data.message).toBeNull()
  })

  it('returns { message: null } when fetch throws (timeout/network error)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    global.fetch = jest.fn().mockRejectedValue(new Error('AbortError'))

    const request = new Request('http://localhost:3000/api/ai/encouragement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validContext),
    })

    const response = await POST(request)
    const data = await response.json()
    expect(data.message).toBeNull()
  })

  it('includes milestone info in API call for milestone context', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        content: [{ text: 'You hit 100 points! Incredible!' }],
      }),
    })

    const milestoneContext = {
      ...validContext,
      isMilestone: true,
      milestoneType: '100-points',
    }

    const request = new Request('http://localhost:3000/api/ai/encouragement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(milestoneContext),
    })

    const response = await POST(request)
    const data = await response.json()
    expect(data.message).toBe('You hit 100 points! Incredible!')
    expect(data.isMilestone).toBe(true)
  })

  it('sends overdue note when task is overdue', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        content: [{ text: 'Better late than never!' }],
      }),
    })

    const overdueContext = { ...validContext, isOverdue: true }

    const request = new Request('http://localhost:3000/api/ai/encouragement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(overdueContext),
    })

    const response = await POST(request)
    const data = await response.json()
    expect(data.message).toBe('Better late than never!')

    // Verify the fetch was called with the overdue note in the body
    const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
    const body = JSON.parse(fetchCall[1].body)
    const userMessage = body.messages[0].content
    expect(userMessage).toContain('completed late')
  })

  it('returns { message: null } on invalid JSON body', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const request = new Request('http://localhost:3000/api/ai/encouragement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid-json',
    })

    const response = await POST(request)
    const data = await response.json()
    expect(data.message).toBeNull()
  })

  it('aborts fetch when timeout fires', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    // Make setTimeout fire immediately so the abort signal triggers
    const originalSetTimeout = global.setTimeout
    global.setTimeout = ((fn: () => void) => originalSetTimeout(fn, 0)) as typeof global.setTimeout

    // Make fetch reject with AbortError when signal is aborted
    global.fetch = jest.fn().mockImplementation((_url: string, options: { signal: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        if (options.signal.aborted) {
          reject(new DOMException('The operation was aborted', 'AbortError'))
          return
        }
        options.signal.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted', 'AbortError'))
        })
      })
    })

    const request = new Request('http://localhost:3000/api/ai/encouragement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validContext),
    })

    const response = await POST(request)
    const data = await response.json()
    expect(data.message).toBeNull()

    global.setTimeout = originalSetTimeout
  })

  it('returns { message: null } when AI response has empty content', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        content: [],
      }),
    })

    const request = new Request('http://localhost:3000/api/ai/encouragement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validContext),
    })

    const response = await POST(request)
    const data = await response.json()
    expect(data.message).toBeNull()
  })
})
