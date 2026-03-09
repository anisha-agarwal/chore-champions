/**
 * @jest-environment node
 */
jest.mock('@/lib/observability/admin-auth', () => ({ validateAdminSession: jest.fn() }))
jest.mock('@/lib/observability/service-client', () => ({ createServiceClient: jest.fn() }))
jest.mock('next/headers', () => ({ cookies: jest.fn() }))

import { GET } from '@/app/api/admin/observability/usage/route'
import { NextRequest } from 'next/server'
import { validateAdminSession } from '@/lib/observability/admin-auth'
import { createServiceClient } from '@/lib/observability/service-client'
import { cookies } from 'next/headers'

const mockValidateAdminSession = validateAdminSession as jest.Mock
const mockCreateServiceClient = createServiceClient as jest.Mock
const mockCookies = cookies as jest.Mock
const mockRpc = jest.fn()

function makeRequest(range?: string): NextRequest {
  return new NextRequest(`http://localhost/api/admin/observability/usage${range ? `?range=${range}` : ''}`)
}

function setupCookies(valid: boolean) {
  mockCookies.mockResolvedValue({ get: () => (valid ? { value: 'token' } : undefined) })
  mockValidateAdminSession.mockResolvedValue(valid)
}

describe('GET /api/admin/observability/usage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCreateServiceClient.mockReturnValue({ rpc: mockRpc })
    mockRpc.mockResolvedValue({ data: {}, error: null })
  })

  it('returns 401 when not authenticated', async () => {
    setupCookies(false)
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('calls get_usage_analytics with default 7 days', async () => {
    setupCookies(true)
    await GET(makeRequest())
    expect(mockRpc).toHaveBeenCalledWith('get_usage_analytics', { p_range_days: 7 })
  })

  it('uses 30 days for 30d range', async () => {
    setupCookies(true)
    await GET(makeRequest('30d'))
    expect(mockRpc).toHaveBeenCalledWith('get_usage_analytics', { p_range_days: 30 })
  })

  it('uses 90 days for 90d range', async () => {
    setupCookies(true)
    await GET(makeRequest('90d'))
    expect(mockRpc).toHaveBeenCalledWith('get_usage_analytics', { p_range_days: 90 })
  })

  it('returns 500 on RPC error', async () => {
    setupCookies(true)
    mockRpc.mockResolvedValue({ data: null, error: { message: 'DB error' } })
    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
  })
})
