/**
 * @jest-environment node
 */
jest.mock('@/lib/observability/admin-auth', () => ({ validateAdminSession: jest.fn() }))
jest.mock('@/lib/observability/service-client', () => ({ createServiceClient: jest.fn() }))
jest.mock('next/headers', () => ({ cookies: jest.fn() }))

import { GET } from '@/app/api/admin/observability/summary/route'
import { NextRequest } from 'next/server'
import { validateAdminSession } from '@/lib/observability/admin-auth'
import { createServiceClient } from '@/lib/observability/service-client'
import { cookies } from 'next/headers'

const mockValidateAdminSession = validateAdminSession as jest.Mock
const mockCreateServiceClient = createServiceClient as jest.Mock
const mockCookies = cookies as jest.Mock
const mockRpc = jest.fn()

function makeRequest(range?: string): NextRequest {
  const url = `http://localhost/api/admin/observability/summary${range ? `?range=${range}` : ''}`
  return new NextRequest(url)
}

function setupCookies(token?: string) {
  mockCookies.mockResolvedValue({
    get: (name: string) => (name === 'admin_obs_session' && token ? { value: token } : undefined),
  })
}

describe('GET /api/admin/observability/summary', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCreateServiceClient.mockReturnValue({ rpc: mockRpc })
  })

  it('returns 401 when not authenticated', async () => {
    setupCookies()
    mockValidateAdminSession.mockResolvedValue(false)
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('returns summary data for 24h range (default)', async () => {
    setupCookies('valid-token')
    mockValidateAdminSession.mockResolvedValue(true)
    mockRpc.mockResolvedValue({ data: { error_count: 5 }, error: null })
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    expect(mockRpc).toHaveBeenCalledWith('get_observability_summary', { p_range_hours: 24 })
  })

  it('uses 168 hours for 7d range', async () => {
    setupCookies('valid-token')
    mockValidateAdminSession.mockResolvedValue(true)
    mockRpc.mockResolvedValue({ data: {}, error: null })
    await GET(makeRequest('7d'))
    expect(mockRpc).toHaveBeenCalledWith('get_observability_summary', { p_range_hours: 168 })
  })

  it('uses 720 hours for 30d range', async () => {
    setupCookies('valid-token')
    mockValidateAdminSession.mockResolvedValue(true)
    mockRpc.mockResolvedValue({ data: {}, error: null })
    await GET(makeRequest('30d'))
    expect(mockRpc).toHaveBeenCalledWith('get_observability_summary', { p_range_hours: 720 })
  })

  it('returns 500 when RPC fails', async () => {
    setupCookies('valid-token')
    mockValidateAdminSession.mockResolvedValue(true)
    mockRpc.mockResolvedValue({ data: null, error: { message: 'RPC error' } })
    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
  })
})
