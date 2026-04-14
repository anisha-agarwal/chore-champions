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
jest.mock('@/lib/supabase/server', () => ({
  createClient: () =>
    Promise.resolve({
      auth: { getUser: () => mockGetUser() },
    }),
}))

import { POST } from '@/app/api/push/test/route'

beforeEach(() => {
  jest.clearAllMocks()
})

describe('POST /api/push/test', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await POST()
    expect(res.status).toBe(401)
  })

  it('calls sendPushToUser with test payload and returns sent count', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSendPushToUser.mockResolvedValue(2)

    const res = await POST()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sent).toBe(2)

    expect(mockSendPushToUser).toHaveBeenCalledWith('user-1', {
      type: 'test',
      title: 'Chore Champions test',
      body: 'Notifications are working on this device.',
      url: '/me?tab=notifications',
    })
  })

  it('returns 0 sent when user has no subscriptions', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSendPushToUser.mockResolvedValue(0)

    const res = await POST()
    const body = await res.json()
    expect(body.sent).toBe(0)
  })
})
