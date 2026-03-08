const mockInsert = jest.fn().mockResolvedValue({ error: null })
const mockFrom = jest.fn().mockReturnValue({ insert: mockInsert })

jest.mock('@/lib/observability/service-client', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}))

import { logError } from '@/lib/observability/error-logger'

describe('logError', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('inserts error record into app_errors', async () => {
    logError({
      error_message: 'Test error',
      error_type: 'api',
      route: '/api/test',
      user_id: 'user-123',
      metadata: { route: '/api/test' },
    })

    // Wait for async fire-and-forget
    await new Promise((r) => setTimeout(r, 10))

    expect(mockFrom).toHaveBeenCalledWith('app_errors')
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        error_message: 'Test error',
        error_type: 'api',
        route: '/api/test',
      })
    )
  })

  it('truncates error_message to 1000 chars', async () => {
    const longMsg = 'x'.repeat(2000)
    logError({ error_message: longMsg, error_type: 'rpc', route: '/test' })

    await new Promise((r) => setTimeout(r, 10))

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ error_message: 'x'.repeat(1000) })
    )
  })

  it('includes optional fields as null when not provided', async () => {
    logError({ error_message: 'err', error_type: 'client', route: '/test' })

    await new Promise((r) => setTimeout(r, 10))

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        error_code: null,
        method: null,
        user_id: null,
      })
    )
  })

  it('does nothing for unknown error_type', async () => {
    // @ts-expect-error - testing invalid input
    logError({ error_message: 'err', error_type: 'unknown', route: '/test' })
    await new Promise((r) => setTimeout(r, 10))
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('does not throw when insert fails', async () => {
    mockInsert.mockRejectedValueOnce(new Error('DB error'))
    expect(() => {
      logError({ error_message: 'err', error_type: 'api', route: '/test' })
    }).not.toThrow()
    await new Promise((r) => setTimeout(r, 10))
  })
})
