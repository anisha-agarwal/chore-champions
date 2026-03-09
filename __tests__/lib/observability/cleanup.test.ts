const mockRpc = jest.fn()

jest.mock('@/lib/observability/service-client', () => ({
  createServiceClient: () => ({ rpc: mockRpc }),
}))

import { runCleanup } from '@/lib/observability/cleanup'

describe('runCleanup', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('calls cleanup_old_observability_data RPC with default 90 days', async () => {
    const mockResult = { errors_deleted: 5, events_deleted: 10, cutoff: '2025-12-01T00:00:00Z' }
    mockRpc.mockResolvedValue({ data: mockResult, error: null })

    const result = await runCleanup()

    expect(mockRpc).toHaveBeenCalledWith('cleanup_old_observability_data', { p_days: 90 })
    expect(result.errors_deleted).toBe(5)
    expect(result.events_deleted).toBe(10)
  })

  it('calls RPC with custom days', async () => {
    mockRpc.mockResolvedValue({ data: { errors_deleted: 0, events_deleted: 0, cutoff: '2025-01-01T00:00:00Z' }, error: null })

    await runCleanup(30)

    expect(mockRpc).toHaveBeenCalledWith('cleanup_old_observability_data', { p_days: 30 })
  })

  it('throws when RPC returns an error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'Permission denied' } })

    await expect(runCleanup()).rejects.toThrow('Permission denied')
  })
})
