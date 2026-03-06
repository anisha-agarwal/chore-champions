/**
 * @jest-environment node
 */
import { POST } from '@/app/api/ai/analytics-insights/route'

// Mock Supabase server client
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

// Mock generateStaticSummary so we can verify fallback behavior
jest.mock('@/lib/analytics-utils', () => ({
  generateStaticSummary: jest.fn(() => 'Static fallback summary'),
}))

import { generateStaticSummary } from '@/lib/analytics-utils'

// Store original fetch
const originalFetch = global.fetch

function makeRequest(body?: unknown): Request {
  if (body === undefined) {
    return new Request('http://localhost:3000/api/ai/analytics-insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid-json!!!',
    })
  }
  return new Request('http://localhost:3000/api/ai/analytics-insights', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// Helper to set up authenticated user with a profile and stats
function setupAuthenticatedUser(opts: {
  role?: 'parent' | 'child'
  familyId?: string | null
  stats?: unknown
}) {
  const { role = 'child', familyId = null, stats = { completions_this_week: 5 } } = opts

  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

  mockFrom.mockReturnValue({
    select: () => ({
      eq: () => ({
        single: () =>
          Promise.resolve({
            data: { family_id: familyId, role },
          }),
      }),
    }),
  })

  mockRpc.mockResolvedValue({ data: stats })
}

describe('POST /api/ai/analytics-insights', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.ANTHROPIC_API_KEY = 'test-api-key'
  })

  afterEach(() => {
    global.fetch = originalFetch
    delete process.env.ANTHROPIC_API_KEY
  })

  it('returns 401 when no authenticated user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const response = await POST(makeRequest({ role: 'child' }))
    expect(response.status).toBe(401)

    const data = await response.json()
    expect(data.error).toBe('Unauthorized')
  })

  it('returns null narrative when no ANTHROPIC_API_KEY env var', async () => {
    delete process.env.ANTHROPIC_API_KEY
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const response = await POST(makeRequest({ role: 'child' }))
    const data = await response.json()

    expect(data.narrative).toBeNull()
    expect(data.generated_at).toBeDefined()
  })

  it('returns null narrative on invalid JSON body', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const request = new Request('http://localhost:3000/api/ai/analytics-insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-valid-json',
    })

    const response = await POST(request)
    const data = await response.json()

    expect(data.narrative).toBeNull()
    expect(data.generated_at).toBeDefined()
  })

  it('returns null narrative when no profile found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null }),
        }),
      }),
    })

    const response = await POST(makeRequest({ role: 'child' }))
    const data = await response.json()

    expect(data.narrative).toBeNull()
  })

  it('returns null narrative when RPC returns no stats', async () => {
    setupAuthenticatedUser({ stats: null })

    const response = await POST(makeRequest({ role: 'child' }))
    const data = await response.json()

    expect(data.narrative).toBeNull()
  })

  it('calls get_kid_analytics RPC for child role', async () => {
    setupAuthenticatedUser({ role: 'child' })

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: [{ text: 'Great week!' }] }),
    })

    await POST(makeRequest({ role: 'child' }))

    expect(mockRpc).toHaveBeenCalledWith('get_kid_analytics', {
      p_user_id: 'user-1',
      p_weeks: 4,
    })
  })

  it('calls get_family_analytics RPC for parent role with family_id', async () => {
    setupAuthenticatedUser({ role: 'parent', familyId: 'family-1' })

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: [{ text: 'Family summary' }] }),
    })

    await POST(makeRequest({ role: 'parent' }))

    expect(mockRpc).toHaveBeenCalledWith('get_family_analytics', {
      p_family_id: 'family-1',
      p_weeks: 4,
    })
  })

  it('uses kid system prompt for child role in Claude API call', async () => {
    setupAuthenticatedUser({ role: 'child' })

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: [{ text: 'Nice job!' }] }),
    })

    await POST(makeRequest({ role: 'child' }))

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
    const body = JSON.parse(fetchCall[1].body)
    expect(body.system).toContain('fun, encouraging coach')
    expect(body.system).toContain('kid')
    expect(body.model).toBe('claude-haiku-4-5-20251001')
    expect(body.max_tokens).toBe(300)
  })

  it('uses parent system prompt for parent role in Claude API call', async () => {
    setupAuthenticatedUser({ role: 'parent', familyId: 'family-1' })

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: [{ text: 'Family insight' }] }),
    })

    await POST(makeRequest({ role: 'parent' }))

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
    const body = JSON.parse(fetchCall[1].body)
    expect(body.system).toContain('analytics assistant')
    expect(body.system).toContain('family')
  })

  it('returns AI narrative on successful API call', async () => {
    setupAuthenticatedUser({ role: 'child' })

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          content: [{ text: '  You completed 5 quests this week!  ' }],
        }),
    })

    const response = await POST(makeRequest({ role: 'child' }))
    const data = await response.json()

    expect(data.narrative).toBe('You completed 5 quests this week!')
    expect(data.generated_at).toBeDefined()
  })

  it('returns null narrative when AI response has no content text', async () => {
    setupAuthenticatedUser({ role: 'child' })

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: [] }),
    })

    const response = await POST(makeRequest({ role: 'child' }))
    const data = await response.json()

    expect(data.narrative).toBeNull()
  })

  it('falls back to static summary when API returns non-ok response', async () => {
    setupAuthenticatedUser({ role: 'child' })

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
    })

    const response = await POST(makeRequest({ role: 'child' }))
    const data = await response.json()

    expect(data.narrative).toBe('Static fallback summary')
    expect(generateStaticSummary).toHaveBeenCalled()
  })

  it('falls back to static summary on network/fetch error', async () => {
    setupAuthenticatedUser({ role: 'child' })

    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

    const response = await POST(makeRequest({ role: 'child' }))
    const data = await response.json()

    expect(data.narrative).toBe('Static fallback summary')
    expect(generateStaticSummary).toHaveBeenCalled()
  })

  it('falls back to static summary on abort/timeout', async () => {
    setupAuthenticatedUser({ role: 'child' })

    global.fetch = jest
      .fn()
      .mockRejectedValue(new DOMException('The operation was aborted', 'AbortError'))

    const response = await POST(makeRequest({ role: 'child' }))
    const data = await response.json()

    expect(data.narrative).toBe('Static fallback summary')
    expect(generateStaticSummary).toHaveBeenCalled()
  })

  it('sends correct headers to Anthropic API', async () => {
    setupAuthenticatedUser({ role: 'child' })

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: [{ text: 'Hi!' }] }),
    })

    await POST(makeRequest({ role: 'child' }))

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
    expect(fetchCall[0]).toBe('https://api.anthropic.com/v1/messages')
    expect(fetchCall[1].headers['x-api-key']).toBe('test-api-key')
    expect(fetchCall[1].headers['anthropic-version']).toBe('2023-06-01')
    expect(fetchCall[1].headers['Content-Type']).toBe('application/json')
  })

  it('defaults to child role when body.role is not "parent"', async () => {
    setupAuthenticatedUser({ role: 'child' })

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: [{ text: 'Hey!' }] }),
    })

    await POST(makeRequest({ role: 'something-else' }))

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
    const body = JSON.parse(fetchCall[1].body)
    expect(body.system).toContain('fun, encouraging coach')
  })

  it('passes abort signal to fetch', async () => {
    setupAuthenticatedUser({ role: 'child' })

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: [{ text: 'Done' }] }),
    })

    await POST(makeRequest({ role: 'child' }))

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
    expect(fetchCall[1].signal).toBeDefined()
    expect(fetchCall[1].signal).toBeInstanceOf(AbortSignal)
  })
})
