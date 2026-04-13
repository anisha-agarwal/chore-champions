/**
 * @jest-environment node
 */
jest.mock('@/lib/observability/middleware-timing', () => ({
  withObservability: (h: unknown) => h,
}))

import { GET, PATCH } from '@/app/api/push/preferences/route'
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

interface QueryResult {
  data: unknown
  error: unknown
}

function makeSelectChain(result: QueryResult) {
  const chain: Record<string, unknown> = {}
  chain.select = () => chain
  chain.eq = () => chain
  chain.maybeSingle = () => Promise.resolve(result)
  chain.single = () => Promise.resolve(result)
  return chain
}

function makeInsertChain(result: QueryResult) {
  const chain: Record<string, unknown> = {}
  chain.insert = () => chain
  chain.select = () => chain
  chain.single = () => Promise.resolve(result)
  return chain
}

function makeUpsertChain(result: QueryResult) {
  const chain: Record<string, unknown> = {}
  chain.upsert = () => chain
  chain.select = () => chain
  chain.single = () => Promise.resolve(result)
  return chain
}

function makeGetRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/push/preferences')
}

function makePatchRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/push/preferences', {
    method: 'PATCH',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

const USER_ID = '00000000-0000-0000-0000-000000000001'

function existingRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    user_id: USER_ID,
    push_enabled: true,
    types_enabled: { task_completed: true, streak_milestone: true, test: true },
    quiet_hours_start: null,
    quiet_hours_end: null,
    timezone: 'UTC',
    updated_at: '2026-04-11T10:00:00Z',
    ...overrides,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('GET /api/push/preferences', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('Unauthorized')
  })

  it('returns existing preferences row when one exists', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
    mockFrom.mockReturnValueOnce(makeSelectChain({ data: existingRow({ push_enabled: false }), error: null }))
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.push_enabled).toBe(false)
    expect(body.data.user_id).toBe(USER_ID)
    expect(body.data.types_enabled.task_completed).toBe(true)
  })

  it('normalizes malformed types_enabled on existing row', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
    mockFrom.mockReturnValueOnce(
      makeSelectChain({ data: existingRow({ types_enabled: { task_completed: false, bogus: true, streak_milestone: 'nope' } }), error: null }),
    )
    const res = await GET(makeGetRequest())
    const body = await res.json()
    expect(body.data.types_enabled).toEqual({
      task_completed: false,
      streak_milestone: true, // non-boolean "nope" is ignored; default preserved
      test: true,
    })
  })

  it('normalizes non-object types_enabled on existing row', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
    mockFrom.mockReturnValueOnce(
      makeSelectChain({ data: existingRow({ types_enabled: null }), error: null }),
    )
    const res = await GET(makeGetRequest())
    const body = await res.json()
    expect(body.data.types_enabled).toEqual({ task_completed: true, streak_milestone: true, test: true })
  })

  it('returns 500 when the select query errors', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
    mockFrom.mockReturnValueOnce(makeSelectChain({ data: null, error: { message: 'boom' } }))
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(500)
  })

  it('auto-creates a default row when none exists', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
    mockFrom
      .mockReturnValueOnce(makeSelectChain({ data: null, error: null }))
      .mockReturnValueOnce(makeInsertChain({ data: existingRow(), error: null }))
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.push_enabled).toBe(true)
  })

  it('returns 500 when insert of default row fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
    mockFrom
      .mockReturnValueOnce(makeSelectChain({ data: null, error: null }))
      .mockReturnValueOnce(makeInsertChain({ data: null, error: { message: 'insert failed' } }))
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(500)
  })

  it('returns 500 when insert returns no row and no error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
    mockFrom
      .mockReturnValueOnce(makeSelectChain({ data: null, error: null }))
      .mockReturnValueOnce(makeInsertChain({ data: null, error: null }))
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(500)
  })
})

describe('PATCH /api/push/preferences', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await PATCH(makePatchRequest({ push_enabled: false }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when body is not valid JSON', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
    const res = await PATCH(makePatchRequest('not json'))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Invalid JSON')
  })

  it('returns 400 when body is null', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
    const res = await PATCH(makePatchRequest(null))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Invalid body')
  })

  it('returns 400 when body is an array', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
    const res = await PATCH(makePatchRequest([]))
    expect(res.status).toBe(400)
  })

  it('returns 400 when push_enabled is not a boolean', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
    const res = await PATCH(makePatchRequest({ push_enabled: 'yes' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/push_enabled/)
  })

  it('returns 400 when types_enabled is not an object', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
    const res = await PATCH(makePatchRequest({ types_enabled: 'foo' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when types_enabled is an array', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
    const res = await PATCH(makePatchRequest({ types_enabled: [] }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when types_enabled contains an unknown type', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
    const res = await PATCH(makePatchRequest({ types_enabled: { bogus: true } }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/Unknown notification type/)
  })

  it('returns 400 when types_enabled has non-boolean value', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
    const res = await PATCH(makePatchRequest({ types_enabled: { task_completed: 'yes' } }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/must be a boolean/)
  })

  it('returns 400 when quiet_hours_start is out of range', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
    const res = await PATCH(makePatchRequest({ quiet_hours_start: 24 }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when quiet_hours_start is negative', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
    const res = await PATCH(makePatchRequest({ quiet_hours_start: -1 }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when quiet_hours_start is not an integer', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
    const res = await PATCH(makePatchRequest({ quiet_hours_start: 3.5 }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when quiet_hours_end is invalid', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
    const res = await PATCH(makePatchRequest({ quiet_hours_end: 'lol' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when timezone is not a string', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
    const res = await PATCH(makePatchRequest({ timezone: 42 }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when timezone is an empty string', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
    const res = await PATCH(makePatchRequest({ timezone: '' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when timezone is unrecognised', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
    const res = await PATCH(makePatchRequest({ timezone: 'Not/A_Zone' }))
    expect(res.status).toBe(400)
  })

  it('merges push_enabled onto existing row, leaving other fields intact', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
    const current = existingRow({ push_enabled: true, quiet_hours_start: 22, quiet_hours_end: 7 })
    let upserted: Record<string, unknown> = {}
    mockFrom
      .mockReturnValueOnce(makeSelectChain({ data: current, error: null }))
      .mockReturnValueOnce({
        upsert: (row: Record<string, unknown>) => {
          upserted = row
          return {
            select: () => ({
              single: () => Promise.resolve({ data: { ...current, ...row, updated_at: '2026-04-11T11:00:00Z' }, error: null }),
            }),
          }
        },
      })

    const res = await PATCH(makePatchRequest({ push_enabled: false }))
    expect(res.status).toBe(200)
    expect(upserted.push_enabled).toBe(false)
    expect(upserted.quiet_hours_start).toBe(22)
    expect(upserted.quiet_hours_end).toBe(7)
    expect(upserted.types_enabled).toEqual({ task_completed: true, streak_milestone: true, test: true })
  })

  it('merges types_enabled partial update onto existing types', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
    const current = existingRow({
      types_enabled: { task_completed: true, streak_milestone: true, test: true },
    })
    let upserted: Record<string, unknown> = {}
    mockFrom
      .mockReturnValueOnce(makeSelectChain({ data: current, error: null }))
      .mockReturnValueOnce({
        upsert: (row: Record<string, unknown>) => {
          upserted = row
          return {
            select: () => ({
              single: () => Promise.resolve({ data: { ...current, ...row }, error: null }),
            }),
          }
        },
      })

    await PATCH(makePatchRequest({ types_enabled: { task_completed: false } }))
    expect(upserted.types_enabled).toEqual({
      task_completed: false,
      streak_milestone: true,
      test: true,
    })
  })

  it('accepts null for quiet_hours fields to clear them', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
    const current = existingRow({ quiet_hours_start: 22, quiet_hours_end: 7 })
    let upserted: Record<string, unknown> = {}
    mockFrom
      .mockReturnValueOnce(makeSelectChain({ data: current, error: null }))
      .mockReturnValueOnce({
        upsert: (row: Record<string, unknown>) => {
          upserted = row
          return {
            select: () => ({
              single: () => Promise.resolve({ data: { ...current, ...row }, error: null }),
            }),
          }
        },
      })
    await PATCH(makePatchRequest({ quiet_hours_start: null, quiet_hours_end: null }))
    expect(upserted.quiet_hours_start).toBeNull()
    expect(upserted.quiet_hours_end).toBeNull()
  })

  it('accepts valid timezone update', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
    const current = existingRow()
    let upserted: Record<string, unknown> = {}
    mockFrom
      .mockReturnValueOnce(makeSelectChain({ data: current, error: null }))
      .mockReturnValueOnce({
        upsert: (row: Record<string, unknown>) => {
          upserted = row
          return {
            select: () => ({
              single: () => Promise.resolve({ data: { ...current, ...row }, error: null }),
            }),
          }
        },
      })
    await PATCH(makePatchRequest({ timezone: 'America/Los_Angeles' }))
    expect(upserted.timezone).toBe('America/Los_Angeles')
  })

  it('falls back to defaults when no existing row exists', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
    let upserted: Record<string, unknown> = {}
    mockFrom
      .mockReturnValueOnce(makeSelectChain({ data: null, error: null }))
      .mockReturnValueOnce({
        upsert: (row: Record<string, unknown>) => {
          upserted = row
          return {
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: { ...existingRow(), ...row, updated_at: '2026-04-11T11:00:00Z' },
                  error: null,
                }),
            }),
          }
        },
      })

    const res = await PATCH(makePatchRequest({ quiet_hours_start: 22, quiet_hours_end: 7 }))
    expect(res.status).toBe(200)
    expect(upserted.user_id).toBe(USER_ID)
    expect(upserted.push_enabled).toBe(true) // default
    expect(upserted.types_enabled).toEqual({ task_completed: true, streak_milestone: true, test: true })
    expect(upserted.quiet_hours_start).toBe(22)
    expect(upserted.quiet_hours_end).toBe(7)
    expect(upserted.timezone).toBe('UTC')
  })

  it('returns 500 when upsert fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
    mockFrom
      .mockReturnValueOnce(makeSelectChain({ data: existingRow(), error: null }))
      .mockReturnValueOnce(makeUpsertChain({ data: null, error: { message: 'boom' } }))
    const res = await PATCH(makePatchRequest({ push_enabled: false }))
    expect(res.status).toBe(500)
  })

  it('returns 500 when upsert returns no row and no error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
    mockFrom
      .mockReturnValueOnce(makeSelectChain({ data: existingRow(), error: null }))
      .mockReturnValueOnce(makeUpsertChain({ data: null, error: null }))
    const res = await PATCH(makePatchRequest({ push_enabled: false }))
    expect(res.status).toBe(500)
  })

  it('ignores a types_enabled with no recognised keys after validation', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
    const current = existingRow()
    let upserted: Record<string, unknown> = {}
    mockFrom
      .mockReturnValueOnce(makeSelectChain({ data: current, error: null }))
      .mockReturnValueOnce({
        upsert: (row: Record<string, unknown>) => {
          upserted = row
          return {
            select: () => ({
              single: () => Promise.resolve({ data: { ...current, ...row }, error: null }),
            }),
          }
        },
      })
    // Empty object passes validation; merge leaves types_enabled untouched.
    const res = await PATCH(makePatchRequest({ types_enabled: {} }))
    expect(res.status).toBe(200)
    expect(upserted.types_enabled).toEqual({ task_completed: true, streak_milestone: true, test: true })
  })
})
