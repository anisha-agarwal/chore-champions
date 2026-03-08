/**
 * @jest-environment node
 */
jest.mock('@/lib/observability/admin-auth', () => ({ validateAdminSession: jest.fn() }))
jest.mock('@/lib/observability/service-client', () => ({ createServiceClient: jest.fn() }))
jest.mock('next/headers', () => ({ cookies: jest.fn() }))

import { GET } from '@/app/api/admin/observability/errors/route'
import { NextRequest } from 'next/server'
import { validateAdminSession } from '@/lib/observability/admin-auth'
import { createServiceClient } from '@/lib/observability/service-client'
import { cookies } from 'next/headers'

const mockValidateAdminSession = validateAdminSession as jest.Mock
const mockCreateServiceClient = createServiceClient as jest.Mock
const mockCookies = cookies as jest.Mock
const mockRpc = jest.fn()

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const qs = new URLSearchParams(params).toString()
  return new NextRequest(`http://localhost/api/admin/observability/errors${qs ? `?${qs}` : ''}`)
}

function setupCookies(valid: boolean) {
  mockCookies.mockResolvedValue({ get: () => (valid ? { value: 'token' } : undefined) })
  mockValidateAdminSession.mockResolvedValue(valid)
}

describe('GET /api/admin/observability/errors', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCreateServiceClient.mockReturnValue({ rpc: mockRpc })
    mockRpc.mockResolvedValue({ data: { errors: [], total: 0, page: 1, total_pages: 1 }, error: null })
  })

  it('returns 401 when not authenticated', async () => {
    setupCookies(false)
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('calls get_recent_errors with defaults', async () => {
    setupCookies(true)
    await GET(makeRequest())
    expect(mockRpc).toHaveBeenCalledWith('get_recent_errors', { p_limit: 20, p_offset: 0, p_type: null, p_range_hours: 24 })
  })

  it('parses page, limit, type, and range params', async () => {
    setupCookies(true)
    await GET(makeRequest({ page: '2', limit: '10', type: 'api', range: '7d' }))
    expect(mockRpc).toHaveBeenCalledWith('get_recent_errors', { p_limit: 10, p_offset: 10, p_type: 'api', p_range_hours: 168 })
  })

  it('clamps limit to max 100', async () => {
    setupCookies(true)
    await GET(makeRequest({ limit: '500' }))
    expect(mockRpc).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ p_limit: 100 }))
  })

  it('returns 500 when RPC fails', async () => {
    setupCookies(true)
    mockRpc.mockResolvedValue({ data: null, error: { message: 'DB error' } })
    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
  })

  it('uses 30d range for 30d param', async () => {
    setupCookies(true)
    await GET(makeRequest({ range: '30d' }))
    expect(mockRpc).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ p_range_hours: 720 }))
  })
})
