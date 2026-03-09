/**
 * @jest-environment node
 */
jest.mock('@/lib/observability/admin-auth', () => ({ validateAdminSession: jest.fn() }))
jest.mock('@/lib/observability/cleanup', () => ({ runCleanup: jest.fn() }))
jest.mock('next/headers', () => ({ cookies: jest.fn() }))

import { POST } from '@/app/api/admin/observability/cleanup/route'
import { validateAdminSession } from '@/lib/observability/admin-auth'
import { runCleanup } from '@/lib/observability/cleanup'
import { cookies } from 'next/headers'

const mockValidateAdminSession = validateAdminSession as jest.Mock
const mockRunCleanup = runCleanup as jest.Mock
const mockCookies = cookies as jest.Mock

function setupCookies(token?: string) {
  mockCookies.mockResolvedValue({
    get: (name: string) => (name === 'admin_obs_session' && token ? { value: token } : undefined),
  })
}

describe('POST /api/admin/observability/cleanup', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    setupCookies()
    mockValidateAdminSession.mockResolvedValue(false)
    const res = await POST()
    expect(res.status).toBe(401)
  })

  it('returns 401 when no session cookie', async () => {
    setupCookies(undefined)
    const res = await POST()
    expect(res.status).toBe(401)
  })

  it('runs cleanup and returns result on success', async () => {
    setupCookies('valid-token')
    mockValidateAdminSession.mockResolvedValue(true)
    const cleanupResult = { errors_deleted: 5, events_deleted: 10, cutoff: '2025-12-08T00:00:00Z' }
    mockRunCleanup.mockResolvedValue(cleanupResult)

    const res = await POST()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual(cleanupResult)
    expect(mockRunCleanup).toHaveBeenCalledWith(90)
  })

  it('returns 500 when cleanup throws', async () => {
    setupCookies('valid-token')
    mockValidateAdminSession.mockResolvedValue(true)
    mockRunCleanup.mockRejectedValue(new Error('DB error'))

    const res = await POST()
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe('DB error')
  })

  it('returns generic message for non-Error throws', async () => {
    setupCookies('valid-token')
    mockValidateAdminSession.mockResolvedValue(true)
    mockRunCleanup.mockRejectedValue('unexpected')

    const res = await POST()
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe('Cleanup failed')
  })
})
