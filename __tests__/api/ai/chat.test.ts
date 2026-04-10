/**
 * @jest-environment node
 */
jest.mock('@/lib/observability/middleware-timing', () => ({
  withObservability: (h: unknown) => h,
}))

jest.mock('@/lib/observability/event-tracker', () => ({
  trackEvent: jest.fn(),
}))

import { POST, maxDuration } from '@/app/api/ai/chat/route'
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

/** Fluent Supabase query chain mock that is thenable */
function makeChain(data: unknown, error: unknown = null) {
  const result = { data, error: error ?? null }
  const chain: Record<string, unknown> = {
    then: (res: (v: unknown) => void, rej?: (e: unknown) => void) =>
      Promise.resolve(result).then(res, rej),
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    limit: () => chain,
    insert: () => chain,
    update: () => chain,
    single: () => Promise.resolve(result),
  }
  return chain
}

/** Create a streaming Anthropic-style SSE response */
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

/** Consume a Response ReadableStream to a string */
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
  return new NextRequest('http://localhost:3000/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const MOCK_PROFILE = { family_id: 'fam-1', role: 'parent', display_name: 'Test Parent' }
const MOCK_CONV = {
  id: 'conv-1',
  family_id: 'fam-1',
  parent_id: 'user-1',
  messages: [],
  title: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

describe('POST /api/ai/chat', () => {
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

  it('returns 401 when no authenticated user', async () => {
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

  it('returns 403 when profile is null', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockFrom.mockReturnValue(makeChain(null))
    const res = await POST(makeRequest({ message: 'Hello' }))
    expect(res.status).toBe(403)
  })

  it('returns 403 when user is not a parent', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockFrom.mockReturnValue(makeChain({ family_id: 'fam-1', role: 'child', display_name: 'Kid' }))
    const res = await POST(makeRequest({ message: 'Hello' }))
    expect(res.status).toBe(403)
  })

  it('returns 400 when profile has no family_id', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockFrom.mockReturnValue(makeChain({ family_id: null, role: 'parent', display_name: 'Parent' }))
    const res = await POST(makeRequest({ message: 'Hello' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 on invalid JSON body', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockFrom.mockReturnValue(makeChain(MOCK_PROFILE))
    const req = new NextRequest('http://localhost:3000/api/ai/chat', {
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
    mockFrom.mockReturnValue(makeChain(MOCK_PROFILE))
    mockRpc.mockResolvedValue({ data: { allowed: true, reason: null } })
    const res = await POST(makeRequest({ message: '' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when message body value is not a string', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockFrom.mockReturnValue(makeChain(MOCK_PROFILE))
    const res = await POST(makeRequest({ message: 42 })) // number, not string
    expect(res.status).toBe(400)
  })

  it('returns 400 when message exceeds 2000 characters', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockFrom.mockReturnValue(makeChain(MOCK_PROFILE))
    const res = await POST(makeRequest({ message: 'a'.repeat(2001) }))
    expect(res.status).toBe(400)
  })

  it('returns 429 with user limit message', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockFrom.mockReturnValue(makeChain(MOCK_PROFILE))
    mockRpc.mockResolvedValue({ data: { allowed: false, reason: 'user_limit' } })
    const res = await POST(makeRequest({ message: 'Hello' }))
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error).toMatch(/personal message limit/)
  })

  it('returns 429 with family limit message', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockFrom.mockReturnValue(makeChain(MOCK_PROFILE))
    mockRpc.mockResolvedValue({ data: { allowed: false, reason: 'family_limit' } })
    const res = await POST(makeRequest({ message: 'Hello' }))
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error).toMatch(/family has reached/)
  })

  it('returns 404 when specified conversation not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return makeChain(MOCK_PROFILE)
      return makeChain(null) // conversation not found
    })
    mockRpc.mockResolvedValue({ data: { allowed: true, reason: null } })
    const res = await POST(makeRequest({ message: 'Hello', conversationId: 'missing-id' }))
    expect(res.status).toBe(404)
  })

  it('returns 500 when conversation creation fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return makeChain(MOCK_PROFILE)
      return makeChain(null, { message: 'Insert failed' }) // insert fails
    })
    mockRpc.mockResolvedValue({ data: { allowed: true, reason: null } })
    const res = await POST(makeRequest({ message: 'Hello' }))
    expect(res.status).toBe(500)
  })

  it('returns 503 when Anthropic API fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    let profilesCallCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        profilesCallCount++
        if (profilesCallCount === 1) return makeChain(MOCK_PROFILE)
        return makeChain([]) // children
      }
      if (table === 'ai_conversations') return makeChain(MOCK_CONV)
      if (table === 'families') return makeChain({ name: 'Smith Family' })
      if (table === 'tasks') return makeChain([])
      return makeChain(null)
    })
    mockRpc.mockResolvedValue({ data: { allowed: true, reason: null } })
    global.fetch = jest.fn().mockResolvedValue({ ok: false, body: null })
    const res = await POST(makeRequest({ message: 'Hello' }))
    expect(res.status).toBe(503)
  })

  it('streams response for new conversation with short message (auto-titles, children/tasks null)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    let profilesCallCount = 0
    let convCallCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        profilesCallCount++
        if (profilesCallCount === 1) return makeChain(MOCK_PROFILE)
        return makeChain(null) // children: null → []
      }
      if (table === 'ai_conversations') {
        convCallCount++
        if (convCallCount === 1) return makeChain(MOCK_CONV) // insert
        return makeChain(null) // update title
      }
      if (table === 'families') return makeChain(null) // no family → 'your family'
      if (table === 'tasks') return makeChain(null) // tasks: null → []
      return makeChain(null)
    })
    mockRpc.mockImplementation((name: string) => {
      if (name === 'check_and_increment_ai_rate_limit') {
        return Promise.resolve({ data: { allowed: true, reason: null } })
      }
      return Promise.resolve({ data: null, error: null })
    })
    global.fetch = jest.fn().mockResolvedValue(makeAnthropicStreamResponse('Hello!'))

    const res = await POST(makeRequest({ message: 'Hi there' }))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/event-stream')

    const content = await consumeStream(res as unknown as Response)
    expect(content).toContain('conversation_meta')
    expect(content).toContain('conv-1')
  })

  it('streams response for new conversation with long message (title truncated)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    let profilesCallCount = 0
    let convCallCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        profilesCallCount++
        if (profilesCallCount === 1) return makeChain(MOCK_PROFILE)
        return makeChain([{ display_name: 'Kid', points: 50 }])
      }
      if (table === 'ai_conversations') {
        convCallCount++
        if (convCallCount === 1) return makeChain(MOCK_CONV)
        return makeChain(null)
      }
      if (table === 'families') return makeChain({ name: 'Smith Family' })
      if (table === 'tasks') return makeChain([
        { title: 'Clean', assigned_to: 'child-1', points: 10, completed: false }, // assigned_to non-null
        { title: 'Other', assigned_to: null, points: 5, completed: null }, // assigned_to null, completed null
      ])
      return makeChain(null)
    })
    mockRpc.mockImplementation((name: string) => {
      if (name === 'check_and_increment_ai_rate_limit') {
        return Promise.resolve({ data: { allowed: true, reason: null } })
      }
      return Promise.resolve({ data: null, error: null })
    })
    global.fetch = jest.fn().mockResolvedValue(makeAnthropicStreamResponse('Got it!'))

    const longMessage = 'a'.repeat(65) // > 60 chars
    const res = await POST(makeRequest({ message: longMessage }))
    const content = await consumeStream(res as unknown as Response)
    expect(content).toContain('conversation_meta')
  })

  it('streams response for existing conversation with title (no title update)', async () => {
    const existingConv = { ...MOCK_CONV, id: 'existing-id', messages: [{ role: 'user', content: 'prev', timestamp: '2024-01-01T00:00:00Z' }], title: 'Existing Title' }
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    let profilesCallCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        profilesCallCount++
        if (profilesCallCount === 1) return makeChain(MOCK_PROFILE)
        return makeChain([])
      }
      if (table === 'ai_conversations') return makeChain(existingConv)
      if (table === 'families') return makeChain({ name: 'Smith Family' })
      if (table === 'tasks') return makeChain([])
      return makeChain(null)
    })
    mockRpc.mockImplementation((name: string) => {
      if (name === 'check_and_increment_ai_rate_limit') {
        return Promise.resolve({ data: { allowed: true, reason: null } })
      }
      return Promise.resolve({ data: null, error: null })
    })
    global.fetch = jest.fn().mockResolvedValue(makeAnthropicStreamResponse('Reply!'))

    const res = await POST(makeRequest({ message: 'Continue', conversationId: 'existing-id' }))
    const content = await consumeStream(res as unknown as Response)
    expect(content).toContain('conversation_meta')
  })

  it('streams response when conversation message limit is reached (skip save)', async () => {
    // 100 messages = CONVERSATION_MESSAGE_LIMIT
    const fullConv = {
      ...MOCK_CONV,
      id: 'full-id',
      messages: Array.from({ length: 100 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `msg ${i}`,
        timestamp: '2024-01-01T00:00:00Z',
      })),
      title: null,
    }
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    let profilesCallCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        profilesCallCount++
        if (profilesCallCount === 1) return makeChain(MOCK_PROFILE)
        return makeChain([])
      }
      if (table === 'ai_conversations') return makeChain(fullConv)
      if (table === 'families') return makeChain({ name: 'Smith Family' })
      if (table === 'tasks') return makeChain([])
      return makeChain(null)
    })
    mockRpc.mockImplementation((name: string) => {
      if (name === 'check_and_increment_ai_rate_limit') {
        return Promise.resolve({ data: { allowed: true, reason: null } })
      }
      return Promise.resolve({ data: null, error: null })
    })
    global.fetch = jest.fn().mockResolvedValue(makeAnthropicStreamResponse('Final reply!'))

    const res = await POST(makeRequest({ message: 'Last message', conversationId: 'full-id' }))
    const content = await consumeStream(res as unknown as Response)
    expect(content).toContain('limitReached":true')
  })
})
