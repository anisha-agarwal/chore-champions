/**
 * @jest-environment node
 */
jest.mock('@/lib/observability/middleware-timing', () => ({
  withObservability: (h: unknown) => h,
}))

jest.mock('@/lib/observability/event-tracker', () => ({
  trackEvent: jest.fn(),
}))

import { POST, maxDuration } from '@/app/api/ai/quest-buddy/route'
import { NextRequest } from 'next/server'

const mockGetUser = jest.fn()
const mockFrom = jest.fn()
const mockRpc = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: () =>
    Promise.resolve({
      auth: { getUser: () => mockGetUser() },
      from: (...args: unknown[]) => mockFrom(...args),
      rpc: (...args: unknown[]) => mockRpc(...args),
    }),
}))

const originalFetch = global.fetch

function makeChain(data: unknown, error: unknown = null) {
  const result = { data, error: error ?? null }
  const chain: Record<string, unknown> = {
    then: (res: (v: unknown) => void, rej?: (e: unknown) => void) =>
      Promise.resolve(result).then(res, rej),
    select: () => chain,
    eq: () => chain,
    gte: () => chain,
    lte: () => chain,
    order: () => chain,
    limit: () => chain,
    insert: () => chain,
    single: () => Promise.resolve(result),
  }
  return chain
}

function makeAnthropicStreamResponse(text: string): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Include a non-text-delta event to cover the "false" branch of the inner if
      controller.enqueue(encoder.encode('data: {"type":"message_start","message":{"id":"msg_01"}}\n\n'))
      controller.enqueue(
        encoder.encode(
          `data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"${text}"}}\n\n`
        )
      )
      controller.close()
    },
  })
  return { ok: true, body: stream } as unknown as Response
}

async function consumeStream(response: Response): Promise<string> {
  if (!response.body) return ''
  const reader = (response.body as ReadableStream<Uint8Array>).getReader()
  const decoder = new TextDecoder()
  let result = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    result += decoder.decode(value)
  }
  return result
}

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/ai/quest-buddy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const MOCK_KID_PROFILE = {
  family_id: 'fam-1',
  role: 'child',
  display_name: 'Timmy',
  points: 50,
}

const MOCK_CHAT = {
  id: 'chat-1',
  child_id: 'user-1',
  family_id: 'fam-1',
  messages: [],
  created_at: '2024-01-01T00:00:00Z',
}

describe('POST /api/ai/quest-buddy', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.ANTHROPIC_API_KEY = 'test-key'
  })

  afterEach(() => {
    global.fetch = originalFetch
    delete process.env.ANTHROPIC_API_KEY
  })

  it('exports maxDuration of 60', () => {
    expect(maxDuration).toBe(60)
  })

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await POST(makeRequest({ message: 'Hello' }))
    expect(res.status).toBe(401)
  })

  it('returns 200 with null data when no API key', async () => {
    delete process.env.ANTHROPIC_API_KEY
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    const res = await POST(makeRequest({ message: 'Hello' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toBeNull()
  })

  it('returns 400 when profile not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockFrom.mockReturnValue(makeChain(null))
    const res = await POST(makeRequest({ message: 'Hello' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when profile has no family_id', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockFrom.mockReturnValue(makeChain({ family_id: null, role: 'child', display_name: 'Kid', points: 10 }))
    const res = await POST(makeRequest({ message: 'Hello' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 on invalid JSON body', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockFrom.mockReturnValue(makeChain(MOCK_KID_PROFILE))
    const req = new NextRequest('http://localhost:3000/api/ai/quest-buddy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json!!!',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid JSON')
  })

  it('returns 400 when message is empty', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockFrom.mockReturnValue(makeChain(MOCK_KID_PROFILE))
    const res = await POST(makeRequest({ message: '' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when message body value is not a string', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockFrom.mockReturnValue(makeChain(MOCK_KID_PROFILE))
    const res = await POST(makeRequest({ message: 42 })) // number, not string
    expect(res.status).toBe(400)
  })

  it('returns 400 when message exceeds 500 characters', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockFrom.mockReturnValue(makeChain(MOCK_KID_PROFILE))
    const res = await POST(makeRequest({ message: 'a'.repeat(501) }))
    expect(res.status).toBe(400)
  })

  it('returns 429 with user limit message', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockFrom.mockReturnValue(makeChain(MOCK_KID_PROFILE))
    mockRpc.mockResolvedValue({ data: { allowed: false, reason: 'user_limit' } })
    const res = await POST(makeRequest({ message: 'Hello' }))
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error).toMatch(/message limit/)
  })

  it('returns 429 with family limit message', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockFrom.mockReturnValue(makeChain(MOCK_KID_PROFILE))
    mockRpc.mockResolvedValue({ data: { allowed: false, reason: 'family_limit' } })
    const res = await POST(makeRequest({ message: 'Hello' }))
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error).toMatch(/family has reached/)
  })

  it('returns 404 when specified chatId not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return makeChain(MOCK_KID_PROFILE)
      return makeChain(null) // chat not found
    })
    mockRpc.mockResolvedValue({ data: { allowed: true, reason: null } })
    const res = await POST(makeRequest({ message: 'Hello', chatId: 'missing-id' }))
    expect(res.status).toBe(404)
  })

  it('returns 429 when chat session limit reached', async () => {
    // KID_SESSION_MESSAGE_LIMIT = 20
    const fullChat = {
      ...MOCK_CHAT,
      messages: Array.from({ length: 20 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `msg ${i}`,
        timestamp: '2024-01-01T00:00:00Z',
      })),
    }
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return makeChain(MOCK_KID_PROFILE)
      return makeChain(fullChat)
    })
    mockRpc.mockResolvedValue({ data: { allowed: true, reason: null } })
    const res = await POST(makeRequest({ message: 'Hello', chatId: 'full-chat' }))
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.reason).toBe('session_limit')
  })

  it('returns 500 when chat creation fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return makeChain(MOCK_KID_PROFILE)
      return makeChain(null, { message: 'Insert failed' })
    })
    mockRpc.mockResolvedValue({ data: { allowed: true, reason: null } })
    const res = await POST(makeRequest({ message: 'Hello' }))
    expect(res.status).toBe(500)
  })

  it('returns 503 when Anthropic API fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return makeChain(MOCK_KID_PROFILE)
      if (table === 'ai_kid_chats') return makeChain(MOCK_CHAT)
      if (table === 'tasks') return makeChain([])
      if (table === 'task_completions') return makeChain([])
      return makeChain(null)
    })
    mockRpc.mockResolvedValue({ data: { allowed: true, reason: null } })
    global.fetch = jest.fn().mockResolvedValue({ ok: false, body: null })
    const res = await POST(makeRequest({ message: 'Hello' }))
    expect(res.status).toBe(503)
  })

  it('streams response for kid new chat session (creates chat, saves messages)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    let callCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        callCount++
        return makeChain(MOCK_KID_PROFILE)
      }
      if (table === 'ai_kid_chats') return makeChain(MOCK_CHAT) // insert
      if (table === 'tasks') return makeChain([{ title: 'Clean room', points: 10 }])
      if (table === 'task_completions') return makeChain([
        { points_earned: 15, completion_date: '2024-01-14' },
        { points_earned: 10, completion_date: null }, // null date → uses today
      ])
      return makeChain(null)
    })
    mockRpc.mockImplementation((name: string) => {
      if (name === 'check_and_increment_ai_rate_limit') {
        return Promise.resolve({ data: { allowed: true, reason: null } })
      }
      return Promise.resolve({ data: null, error: null })
    })
    global.fetch = jest.fn().mockResolvedValue(makeAnthropicStreamResponse('Great job!'))

    const res = await POST(makeRequest({ message: 'Hello' }))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/event-stream')

    const content = await consumeStream(res as unknown as Response)
    expect(content).toContain('chat_meta')
    expect(content).toContain('chat-1')
  })

  it('streams response for parent preview mode (does not persist chat)', async () => {
    const parentProfile = { ...MOCK_KID_PROFILE, role: 'parent' }
    mockGetUser.mockResolvedValue({ data: { user: { id: 'parent-1' } } })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return makeChain(parentProfile)
      if (table === 'tasks') return makeChain(null) // null → covers pendingTasks ?? []
      if (table === 'task_completions') return makeChain(null) // null → covers recentCompletions ?? []
      return makeChain(null)
    })
    mockRpc.mockImplementation((name: string) => {
      if (name === 'check_and_increment_ai_rate_limit') {
        return Promise.resolve({ data: { allowed: true, reason: null } })
      }
      return Promise.resolve({ data: null, error: null })
    })
    global.fetch = jest.fn().mockResolvedValue(makeAnthropicStreamResponse('Parent preview!'))

    const res = await POST(makeRequest({ message: 'Test message' }))
    const content = await consumeStream(res as unknown as Response)
    expect(content).toContain('chat_meta')
    // Parent preview: chatId should be null
    expect(content).toContain('"chatId":null')
  })

  it('streams response for kid with existing chat and limitReached', async () => {
    // KID_SESSION_MESSAGE_LIMIT = 20; start with 18 messages → after adding 2 = 20 → limitReached
    const nearLimitChat = {
      ...MOCK_CHAT,
      id: 'near-limit',
      messages: Array.from({ length: 18 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `msg ${i}`,
        timestamp: '2024-01-01T00:00:00Z',
      })),
    }
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    let callCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        callCount++
        return makeChain(MOCK_KID_PROFILE)
      }
      if (table === 'ai_kid_chats') return makeChain(nearLimitChat)
      if (table === 'tasks') return makeChain([])
      if (table === 'task_completions') return makeChain([])
      return makeChain(null)
    })
    mockRpc.mockImplementation((name: string) => {
      if (name === 'check_and_increment_ai_rate_limit') {
        return Promise.resolve({ data: { allowed: true, reason: null } })
      }
      return Promise.resolve({ data: null, error: null })
    })
    global.fetch = jest.fn().mockResolvedValue(makeAnthropicStreamResponse('Almost done!'))

    const res = await POST(makeRequest({ message: 'Last message', chatId: 'near-limit' }))
    const content = await consumeStream(res as unknown as Response)
    expect(content).toContain('limitReached":true')
  })
})
