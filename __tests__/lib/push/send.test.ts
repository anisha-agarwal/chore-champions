/**
 * @jest-environment node
 */

const mockSendNotification = jest.fn()
jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: (...args: unknown[]) => mockSendNotification(...args),
}))

const mockTrackEvent = jest.fn()
jest.mock('@/lib/observability/event-tracker', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}))

const mockFrom = jest.fn()
jest.mock('@/lib/observability/service-client', () => ({
  createServiceClient: () => ({ from: (...args: unknown[]) => mockFrom(...args) }),
}))

import { sendPushToUser, type PushPayload } from '@/lib/push/send'

const PAYLOAD: PushPayload = {
  type: 'test',
  title: 'Test title',
  body: 'Test body',
  url: '/test',
  tag: 'test-tag',
}

const SUB_ROW = {
  id: 'sub-1',
  endpoint: 'https://push.example.com/sub-1',
  p256dh_key: 'pk',
  auth_key: 'ak',
}

const DEFAULT_PREFS = {
  push_enabled: true,
  types_enabled: { task_completed: true, streak_milestone: true, test: true },
  quiet_hours_start: null,
  quiet_hours_end: null,
  timezone: 'UTC',
}

function makeSelectChain(data: unknown) {
  const chain: Record<string, unknown> = {}
  chain.select = () => chain
  chain.eq = () => chain
  chain.maybeSingle = () => Promise.resolve({ data, error: null })
  return chain
}

function makeDeleteChain() {
  const chain: Record<string, unknown> = {}
  chain.delete = () => chain
  chain.eq = () => Promise.resolve({ error: null })
  return chain
}

const originalEnv = { ...process.env }

beforeEach(() => {
  jest.clearAllMocks()
  mockSendNotification.mockResolvedValue({})
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'test-pub'
  process.env.VAPID_PRIVATE_KEY = 'test-priv'
  process.env.VAPID_SUBJECT = 'mailto:test@example.com'
})

afterEach(() => {
  process.env = { ...originalEnv }
})

describe('sendPushToUser', () => {
  it('sends push to all subscriptions and returns count', async () => {
    let callNum = 0
    mockFrom.mockImplementation((table: string) => {
      callNum++
      if (table === 'notification_preferences') {
        return makeSelectChain(DEFAULT_PREFS)
      }
      if (table === 'push_subscriptions') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [SUB_ROW, { ...SUB_ROW, id: 'sub-2', endpoint: 'https://push.example.com/sub-2' }], error: null }),
          }),
        }
      }
      return makeDeleteChain()
    })

    const count = await sendPushToUser('user-1', PAYLOAD)
    expect(count).toBe(2)
    expect(mockSendNotification).toHaveBeenCalledTimes(2)
    expect(mockTrackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'push_notification_sent',
        metadata: expect.objectContaining({ subscriberCount: 2 }),
      }),
    )
  })

  it('returns 0 when push_enabled is false', async () => {
    mockFrom.mockReturnValue(makeSelectChain({ ...DEFAULT_PREFS, push_enabled: false }))
    const count = await sendPushToUser('user-1', PAYLOAD)
    expect(count).toBe(0)
    expect(mockSendNotification).not.toHaveBeenCalled()
  })

  it('returns 0 when type is disabled', async () => {
    mockFrom.mockReturnValue(
      makeSelectChain({ ...DEFAULT_PREFS, types_enabled: { ...DEFAULT_PREFS.types_enabled, test: false } }),
    )
    const count = await sendPushToUser('user-1', PAYLOAD)
    expect(count).toBe(0)
  })

  it('returns 0 when within quiet hours', async () => {
    const now = new Date()
    const hour = now.getUTCHours()
    mockFrom.mockReturnValue(
      makeSelectChain({
        ...DEFAULT_PREFS,
        quiet_hours_start: hour,
        quiet_hours_end: (hour + 2) % 24,
        timezone: 'UTC',
      }),
    )
    const count = await sendPushToUser('user-1', PAYLOAD)
    expect(count).toBe(0)
  })

  it('returns 0 when no subscriptions exist', async () => {
    let callNum = 0
    mockFrom.mockImplementation((table: string) => {
      callNum++
      if (table === 'notification_preferences') {
        return makeSelectChain(DEFAULT_PREFS)
      }
      return {
        select: () => ({
          eq: () => Promise.resolve({ data: [], error: null }),
        }),
      }
    })
    const count = await sendPushToUser('user-1', PAYLOAD)
    expect(count).toBe(0)
  })

  it('returns 0 when subscriptions data is null', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'notification_preferences') {
        return makeSelectChain(DEFAULT_PREFS)
      }
      return {
        select: () => ({
          eq: () => Promise.resolve({ data: null, error: null }),
        }),
      }
    })
    const count = await sendPushToUser('user-1', PAYLOAD)
    expect(count).toBe(0)
  })

  it('returns 0 when VAPID keys are missing', async () => {
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    mockFrom.mockImplementation((table: string) => {
      if (table === 'notification_preferences') {
        return makeSelectChain(DEFAULT_PREFS)
      }
      return {
        select: () => ({
          eq: () => Promise.resolve({ data: [SUB_ROW], error: null }),
        }),
      }
    })
    const count = await sendPushToUser('user-1', PAYLOAD)
    expect(count).toBe(0)
  })

  it('returns 0 when VAPID private key is missing', async () => {
    delete process.env.VAPID_PRIVATE_KEY
    mockFrom.mockImplementation((table: string) => {
      if (table === 'notification_preferences') {
        return makeSelectChain(DEFAULT_PREFS)
      }
      return {
        select: () => ({
          eq: () => Promise.resolve({ data: [SUB_ROW], error: null }),
        }),
      }
    })
    const count = await sendPushToUser('user-1', PAYLOAD)
    expect(count).toBe(0)
  })

  it('returns 0 when VAPID subject is missing', async () => {
    delete process.env.VAPID_SUBJECT
    mockFrom.mockImplementation((table: string) => {
      if (table === 'notification_preferences') {
        return makeSelectChain(DEFAULT_PREFS)
      }
      return {
        select: () => ({
          eq: () => Promise.resolve({ data: [SUB_ROW], error: null }),
        }),
      }
    })
    const count = await sendPushToUser('user-1', PAYLOAD)
    expect(count).toBe(0)
  })

  it('deletes subscription and tracks event on 410 Gone', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'notification_preferences') {
        return makeSelectChain(DEFAULT_PREFS)
      }
      if (table === 'push_subscriptions') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [SUB_ROW], error: null }),
          }),
          delete: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        }
      }
      return makeDeleteChain()
    })

    mockSendNotification.mockRejectedValue({ statusCode: 410, message: 'Gone' })

    const count = await sendPushToUser('user-1', PAYLOAD)
    expect(count).toBe(0)
    expect(mockTrackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'push_subscription_deleted',
        metadata: expect.objectContaining({ failureReason: '410 Gone' }),
      }),
    )
  })

  it('deletes subscription on 404', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'notification_preferences') {
        return makeSelectChain(DEFAULT_PREFS)
      }
      return {
        select: () => ({
          eq: () => Promise.resolve({ data: [SUB_ROW], error: null }),
        }),
        delete: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
      }
    })

    mockSendNotification.mockRejectedValue({ statusCode: 404, message: 'Not Found' })
    await sendPushToUser('user-1', PAYLOAD)
    expect(mockTrackEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'push_subscription_deleted' }),
    )
  })

  it('tracks failure event on other errors without deleting', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'notification_preferences') {
        return makeSelectChain(DEFAULT_PREFS)
      }
      return {
        select: () => ({
          eq: () => Promise.resolve({ data: [SUB_ROW], error: null }),
        }),
      }
    })

    mockSendNotification.mockRejectedValue(new Error('Network error'))

    const count = await sendPushToUser('user-1', PAYLOAD)
    expect(count).toBe(0)
    expect(mockTrackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'push_notification_failed',
        metadata: expect.objectContaining({ failureReason: 'Network error' }),
      }),
    )
  })

  it('tracks failure with stringified error for non-Error throws', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'notification_preferences') {
        return makeSelectChain(DEFAULT_PREFS)
      }
      return {
        select: () => ({
          eq: () => Promise.resolve({ data: [SUB_ROW], error: null }),
        }),
      }
    })

    mockSendNotification.mockRejectedValue('string error')

    await sendPushToUser('user-1', PAYLOAD)
    expect(mockTrackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'push_notification_failed',
        metadata: expect.objectContaining({ failureReason: 'string error' }),
      }),
    )
  })

  it('uses defaults when no preferences row exists', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'notification_preferences') {
        return makeSelectChain(null)
      }
      return {
        select: () => ({
          eq: () => Promise.resolve({ data: [SUB_ROW], error: null }),
        }),
      }
    })

    const count = await sendPushToUser('user-1', PAYLOAD)
    expect(count).toBe(1)
  })

  it('handles non-object types_enabled gracefully', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'notification_preferences') {
        return makeSelectChain({ ...DEFAULT_PREFS, types_enabled: 'invalid' })
      }
      return {
        select: () => ({
          eq: () => Promise.resolve({ data: [SUB_ROW], error: null }),
        }),
      }
    })

    const count = await sendPushToUser('user-1', PAYLOAD)
    expect(count).toBe(1)
  })

  it('uses default url and tag when not provided', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'notification_preferences') {
        return makeSelectChain(DEFAULT_PREFS)
      }
      return {
        select: () => ({
          eq: () => Promise.resolve({ data: [SUB_ROW], error: null }),
        }),
      }
    })

    await sendPushToUser('user-1', { type: 'test', title: 'T', body: 'B' })
    const sentPayload = JSON.parse(mockSendNotification.mock.calls[0][1])
    expect(sentPayload.url).toBe('/')
    expect(sentPayload.tag).toBe('test')
  })
})
