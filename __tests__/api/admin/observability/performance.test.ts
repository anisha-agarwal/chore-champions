/**
 * @jest-environment node
 */
jest.mock('@/lib/observability/admin-auth', () => ({ validateAdminSession: jest.fn() }))
jest.mock('@/lib/observability/service-client', () => ({ createServiceClient: jest.fn() }))
jest.mock('next/headers', () => ({ cookies: jest.fn() }))

import { GET } from '@/app/api/admin/observability/performance/route'
import { NextRequest } from 'next/server'
import { validateAdminSession } from '@/lib/observability/admin-auth'
import { createServiceClient } from '@/lib/observability/service-client'
import { cookies } from 'next/headers'

const mockValidateAdminSession = validateAdminSession as jest.Mock
const mockCreateServiceClient = createServiceClient as jest.Mock
const mockCookies = cookies as jest.Mock
const mockRpc = jest.fn()

function makeRequest(range?: string): NextRequest {
  return new NextRequest(`http://localhost/api/admin/observability/performance${range ? `?range=${range}` : ''}`)
}

function setupCookies(valid: boolean) {
  mockCookies.mockResolvedValue({ get: () => (valid ? { value: 'token' } : undefined) })
  mockValidateAdminSession.mockResolvedValue(valid)
}

describe('GET /api/admin/observability/performance', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCreateServiceClient.mockReturnValue({ rpc: mockRpc })
    mockRpc.mockResolvedValue({ data: { route_latency: [], rpc_timing: [], latency_trend: [] }, error: null })
  })

  it('returns 401 when not authenticated', async () => {
    setupCookies(false)
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('calls get_performance_metrics with default 24h', async () => {
    setupCookies(true)
    await GET(makeRequest())
    expect(mockRpc).toHaveBeenCalledWith('get_performance_metrics', { p_range_hours: 24 })
  })

  it('uses 168 hours for 7d', async () => {
    setupCookies(true)
    await GET(makeRequest('7d'))
    expect(mockRpc).toHaveBeenCalledWith('get_performance_metrics', { p_range_hours: 168 })
  })

  it('uses 720 hours for 30d', async () => {
    setupCookies(true)
    await GET(makeRequest('30d'))
    expect(mockRpc).toHaveBeenCalledWith('get_performance_metrics', { p_range_hours: 720 })
  })

  it('returns 500 on RPC error', async () => {
    setupCookies(true)
    mockRpc.mockResolvedValue({ data: null, error: { message: 'error' } })
    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
  })
})
