/**
 * @jest-environment node
 */
import { POST } from '@/app/api/ai/parse-quest/route'

// Mock Supabase server client
const mockGetUser = jest.fn()
const mockFrom = jest.fn()
jest.mock('@/lib/supabase/server', () => ({
  createClient: () => Promise.resolve({
    auth: {
      getUser: () => mockGetUser(),
    },
    from: (table: string) => mockFrom(table),
  }),
}))

// Store original fetch
const originalFetch = global.fetch

const mockMembers = [
  { id: 'user-1', display_name: 'Sarah', nickname: 'Sar' },
  { id: 'user-2', display_name: 'Timothy', nickname: 'Timmy' },
]

function setupAuthenticatedUser() {
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

  // Mock profiles.select().eq().single() for family_id
  const mockSingle = jest.fn().mockResolvedValue({ data: { family_id: 'family-1' } })
  const mockEqFamily = jest.fn().mockReturnValue({ single: mockSingle })
  const mockSelectFamily = jest.fn().mockReturnValue({ eq: mockEqFamily })

  // Mock profiles.select().eq() for members
  const mockEqMembers = jest.fn().mockResolvedValue({ data: mockMembers })
  const mockSelectMembers = jest.fn().mockReturnValue({ eq: mockEqMembers })

  let callCount = 0
  mockFrom.mockImplementation(() => {
    callCount++
    if (callCount === 1) {
      return { select: mockSelectFamily }
    }
    return { select: mockSelectMembers }
  })
}

function makeRequest(body: unknown) {
  return new Request('http://localhost:3000/api/ai/parse-quest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/ai/parse-quest', () => {
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

    const response = await POST(makeRequest({ input: 'Make bed for Sarah' }))
    expect(response.status).toBe(401)

    const data = await response.json()
    expect(data.error).toBe('Unauthorized')
  })

  it('returns { prefill: null } when ANTHROPIC_API_KEY is missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    delete process.env.ANTHROPIC_API_KEY

    const response = await POST(makeRequest({ input: 'Make bed' }))
    const data = await response.json()
    expect(data.prefill).toBeNull()
  })

  it('returns { prefill: null } on invalid JSON body', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const request = new Request('http://localhost:3000/api/ai/parse-quest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid-json',
    })

    const response = await POST(request)
    const data = await response.json()
    expect(data.prefill).toBeNull()
  })

  it('returns { prefill: null } on empty input', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const response = await POST(makeRequest({ input: '' }))
    const data = await response.json()
    expect(data.prefill).toBeNull()
  })

  it('returns { prefill: null } on missing input field', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const response = await POST(makeRequest({ foo: 'bar' }))
    const data = await response.json()
    expect(data.prefill).toBeNull()
  })

  it('returns { prefill: null } on whitespace-only input', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const response = await POST(makeRequest({ input: '   ' }))
    const data = await response.json()
    expect(data.prefill).toBeNull()
  })

  it('returns { prefill: null } when input is not a string', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const response = await POST(makeRequest({ input: 123 }))
    const data = await response.json()
    expect(data.prefill).toBeNull()
  })

  it('returns successful prefill with snapped points and matched assignee', async () => {
    setupAuthenticatedUser()

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        content: [
          {
            type: 'tool_use',
            name: 'extract_quest',
            input: {
              title: 'Make bed',
              description: 'Make the bed every morning',
              points: 7,
              time_of_day: 'morning',
              recurring: 'daily',
              assigned_to: 'Sarah',
            },
          },
        ],
      }),
    })

    const response = await POST(makeRequest({ input: 'Daily quest for Sarah to make her bed, 7 points' }))
    const data = await response.json()

    expect(data.prefill).toEqual({
      title: 'Make bed',
      description: 'Make the bed every morning',
      points: 5, // 7 snapped to 5
      time_of_day: 'morning',
      recurring: 'daily',
      assigned_to: 'user-1', // Sarah matched
    })
  })

  it('returns prefill with defaults for missing optional fields', async () => {
    setupAuthenticatedUser()

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        content: [
          {
            type: 'tool_use',
            name: 'extract_quest',
            input: {
              title: 'Clean room',
            },
          },
        ],
      }),
    })

    const response = await POST(makeRequest({ input: 'Clean room' }))
    const data = await response.json()

    expect(data.prefill).toEqual({
      title: 'Clean room',
      description: '',
      points: 10, // default 10, snapped
      time_of_day: 'anytime',
      recurring: null,
      assigned_to: null,
    })
  })

  it('returns { prefill: null } when Anthropic API returns non-ok response', async () => {
    setupAuthenticatedUser()

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
    })

    const response = await POST(makeRequest({ input: 'Make bed' }))
    const data = await response.json()
    expect(data.prefill).toBeNull()
  })

  it('returns { prefill: null } when fetch throws (timeout/network error)', async () => {
    setupAuthenticatedUser()

    global.fetch = jest.fn().mockRejectedValue(new Error('AbortError'))

    const response = await POST(makeRequest({ input: 'Make bed' }))
    const data = await response.json()
    expect(data.prefill).toBeNull()
  })

  it('returns { prefill: null } when AI response has no tool_use block', async () => {
    setupAuthenticatedUser()

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        content: [
          { type: 'text', text: 'I cannot parse that.' },
        ],
      }),
    })

    const response = await POST(makeRequest({ input: 'Make bed' }))
    const data = await response.json()
    expect(data.prefill).toBeNull()
  })

  it('sends tool_choice and tools in the API request body', async () => {
    setupAuthenticatedUser()

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        content: [
          {
            type: 'tool_use',
            name: 'extract_quest',
            input: { title: 'Test' },
          },
        ],
      }),
    })

    await POST(makeRequest({ input: 'Make bed' }))

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
    const body = JSON.parse(fetchCall[1].body)

    expect(body.tool_choice).toEqual({ type: 'tool', name: 'extract_quest' })
    expect(body.tools).toHaveLength(1)
    expect(body.tools[0].name).toBe('extract_quest')
  })

  it('includes family member names in the user prompt', async () => {
    setupAuthenticatedUser()

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        content: [
          {
            type: 'tool_use',
            name: 'extract_quest',
            input: { title: 'Test' },
          },
        ],
      }),
    })

    await POST(makeRequest({ input: 'Make bed' }))

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
    const body = JSON.parse(fetchCall[1].body)
    const userMessage = body.messages[0].content

    expect(userMessage).toContain('Sar')
    expect(userMessage).toContain('Timmy')
  })

  it('handles user with no family_id', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const mockSingle = jest.fn().mockResolvedValue({ data: { family_id: null } })
    const mockEq = jest.fn().mockReturnValue({ single: mockSingle })
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        content: [
          {
            type: 'tool_use',
            name: 'extract_quest',
            input: { title: 'Make bed', assigned_to: 'Nobody' },
          },
        ],
      }),
    })

    const response = await POST(makeRequest({ input: 'Make bed' }))
    const data = await response.json()

    expect(data.prefill).toBeDefined()
    expect(data.prefill.assigned_to).toBeNull()
  })

  it('handles null members data from supabase', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const mockSingle = jest.fn().mockResolvedValue({ data: { family_id: 'family-1' } })
    const mockEqFamily = jest.fn().mockReturnValue({ single: mockSingle })
    const mockSelectFamily = jest.fn().mockReturnValue({ eq: mockEqFamily })

    const mockEqMembers = jest.fn().mockResolvedValue({ data: null })
    const mockSelectMembers = jest.fn().mockReturnValue({ eq: mockEqMembers })

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return { select: mockSelectFamily }
      }
      return { select: mockSelectMembers }
    })

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        content: [
          {
            type: 'tool_use',
            name: 'extract_quest',
            input: { title: 'Make bed' },
          },
        ],
      }),
    })

    const response = await POST(makeRequest({ input: 'Make bed' }))
    const data = await response.json()

    expect(data.prefill).toBeDefined()
    expect(data.prefill.title).toBe('Make bed')
  })

  it('uses 5-second timeout for abort controller', async () => {
    setupAuthenticatedUser()

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        content: [
          {
            type: 'tool_use',
            name: 'extract_quest',
            input: { title: 'Test' },
          },
        ],
      }),
    })

    await POST(makeRequest({ input: 'Make bed' }))

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
    expect(fetchCall[1].signal).toBeDefined()
    expect(fetchCall[1].signal).toBeInstanceOf(AbortSignal)
  })

  it('aborts fetch when timeout fires', async () => {
    setupAuthenticatedUser()

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

    const response = await POST(makeRequest({ input: 'Make bed' }))
    const data = await response.json()
    expect(data.prefill).toBeNull()

    global.setTimeout = originalSetTimeout
  })

  it('returns { prefill: null } when tool_use block has no input', async () => {
    setupAuthenticatedUser()

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        content: [
          {
            type: 'tool_use',
            name: 'extract_quest',
            input: null,
          },
        ],
      }),
    })

    const response = await POST(makeRequest({ input: 'Make bed' }))
    const data = await response.json()
    expect(data.prefill).toBeNull()
  })

  it('handles null profile data (no profile found)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const mockSingle = jest.fn().mockResolvedValue({ data: null })
    const mockEq = jest.fn().mockReturnValue({ single: mockSingle })
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        content: [
          {
            type: 'tool_use',
            name: 'extract_quest',
            input: { title: 'Make bed' },
          },
        ],
      }),
    })

    const response = await POST(makeRequest({ input: 'Make bed' }))
    const data = await response.json()

    expect(data.prefill).toBeDefined()
    expect(data.prefill.title).toBe('Make bed')
  })

  it('uses display_name when member has no nickname in memberNames', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const mockSingle = jest.fn().mockResolvedValue({ data: { family_id: 'family-1' } })
    const mockEqFamily = jest.fn().mockReturnValue({ single: mockSingle })
    const mockSelectFamily = jest.fn().mockReturnValue({ eq: mockEqFamily })

    const mockEqMembers = jest.fn().mockResolvedValue({
      data: [{ id: 'user-3', display_name: 'Alex', nickname: null }],
    })
    const mockSelectMembers = jest.fn().mockReturnValue({ eq: mockEqMembers })

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return { select: mockSelectFamily }
      }
      return { select: mockSelectMembers }
    })

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        content: [
          {
            type: 'tool_use',
            name: 'extract_quest',
            input: { title: 'Test' },
          },
        ],
      }),
    })

    await POST(makeRequest({ input: 'Make bed' }))

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
    const body = JSON.parse(fetchCall[1].body)
    const userMessage = body.messages[0].content

    expect(userMessage).toContain('Alex')
  })

  it('returns prefill with empty title when AI returns no title', async () => {
    setupAuthenticatedUser()

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        content: [
          {
            type: 'tool_use',
            name: 'extract_quest',
            input: {
              description: 'Some task',
            },
          },
        ],
      }),
    })

    const response = await POST(makeRequest({ input: 'Something vague' }))
    const data = await response.json()

    expect(data.prefill.title).toBe('')
  })

  it('includes "No family members" text when no members exist', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const mockSingle = jest.fn().mockResolvedValue({ data: { family_id: null } })
    const mockEq = jest.fn().mockReturnValue({ single: mockSingle })
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        content: [
          {
            type: 'tool_use',
            name: 'extract_quest',
            input: { title: 'Test' },
          },
        ],
      }),
    })

    await POST(makeRequest({ input: 'Make bed' }))

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
    const body = JSON.parse(fetchCall[1].body)
    const userMessage = body.messages[0].content

    expect(userMessage).toContain('No family members available')
  })
})
