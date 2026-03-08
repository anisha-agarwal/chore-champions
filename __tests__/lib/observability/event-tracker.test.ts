const mockInsert = jest.fn().mockResolvedValue({ error: null })
const mockFrom = jest.fn().mockReturnValue({ insert: mockInsert })

jest.mock('@/lib/observability/service-client', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}))

import { trackEvent } from '@/lib/observability/event-tracker'

describe('trackEvent', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('inserts event record into app_events', async () => {
    trackEvent({
      event_type: 'task_completed',
      user_id: 'user-123',
      family_id: 'family-456',
      metadata: { taskName: 'Wash dishes' },
      duration_ms: 200,
    })

    await new Promise((r) => setTimeout(r, 10))

    expect(mockFrom).toHaveBeenCalledWith('app_events')
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'task_completed',
        user_id: 'user-123',
        family_id: 'family-456',
        duration_ms: 200,
      })
    )
  })

  it('includes null for optional fields when not provided', async () => {
    trackEvent({ event_type: 'page_view' })

    await new Promise((r) => setTimeout(r, 10))

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: null,
        family_id: null,
        duration_ms: null,
      })
    )
  })

  it('does nothing for unknown event_type', async () => {
    // @ts-expect-error - testing invalid input
    trackEvent({ event_type: 'unknown_event' })
    await new Promise((r) => setTimeout(r, 10))
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('does not throw when insert fails', async () => {
    mockInsert.mockRejectedValueOnce(new Error('DB error'))
    expect(() => {
      trackEvent({ event_type: 'api_request' })
    }).not.toThrow()
    await new Promise((r) => setTimeout(r, 10))
  })
})
