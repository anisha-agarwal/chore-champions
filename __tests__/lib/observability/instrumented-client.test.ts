/**
 * @jest-environment node
 */
jest.mock('@/lib/observability/error-logger', () => ({ logError: jest.fn() }))
jest.mock('@/lib/observability/event-tracker', () => ({ trackEvent: jest.fn() }))

import { instrumentedRpc } from '@/lib/observability/instrumented-client'
import { logError } from '@/lib/observability/error-logger'
import { trackEvent } from '@/lib/observability/event-tracker'

const mockLogError = logError as jest.Mock
const mockTrackEvent = trackEvent as jest.Mock

function makeSupabase(data: unknown, error: unknown) {
  return {
    rpc: jest.fn().mockResolvedValue({ data, error }),
  }
}

describe('instrumentedRpc', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns data and null error on success', async () => {
    const supabase = makeSupabase({ result: 'ok' }, null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await instrumentedRpc(supabase as any, 'get_data', {}, { route: '/api/test' })

    expect(result.data).toEqual({ result: 'ok' })
    expect(result.error).toBeNull()
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('calls trackEvent on success', async () => {
    const supabase = makeSupabase({}, null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await instrumentedRpc(supabase as any, 'get_data', {}, { route: '/api/test' })

    expect(mockTrackEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'rpc_call', metadata: expect.objectContaining({ rpcName: 'get_data', success: true }) })
    )
  })

  it('calls logError and trackEvent on RPC error', async () => {
    const rpcError = { message: 'DB error', code: '42501' }
    const supabase = makeSupabase(null, rpcError)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await instrumentedRpc(supabase as any, 'broken_rpc', { p: 1 }, { route: '/api/test', userId: 'u1' })

    expect(result.error).toEqual(rpcError)
    expect(result.data).toBeNull()

    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({ error_message: 'DB error', error_type: 'rpc', error_code: '42501', user_id: 'u1' })
    )
    expect(mockTrackEvent).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ success: false }) })
    )
  })

  it('passes args to supabase.rpc', async () => {
    const supabase = makeSupabase(null, null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await instrumentedRpc(supabase as any, 'my_rpc', { p_id: '123' }, { route: '/api/test' })
    expect(supabase.rpc).toHaveBeenCalledWith('my_rpc', { p_id: '123' })
  })
})
