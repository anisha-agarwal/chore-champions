/**
 * @jest-environment node
 */
jest.mock('@/lib/observability/admin-auth', () => ({ validateAdminSession: jest.fn() }))
jest.mock('@/lib/observability/service-client', () => ({ createServiceClient: jest.fn() }))
jest.mock('next/headers', () => ({ cookies: jest.fn() }))

import { GET } from '@/app/api/observability/health/route'
import { validateAdminSession } from '@/lib/observability/admin-auth'
import { createServiceClient } from '@/lib/observability/service-client'
import { cookies } from 'next/headers'

const mockValidateAdminSession = validateAdminSession as jest.Mock
const mockCreateServiceClient = createServiceClient as jest.Mock
const mockCookies = cookies as jest.Mock

function setupCookies(token?: string) {
  mockCookies.mockResolvedValue({
    get: (name: string) => (name === 'admin_obs_session' && token ? { value: token } : undefined),
  })
}

function setupSupabase(errorsOk: boolean, eventsOk: boolean) {
  mockCreateServiceClient.mockReturnValue({
    from: jest.fn().mockImplementation((table: string) => {
      if (table === 'app_errors') {
        return {
          select: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue(errorsOk ? { error: null } : { error: { message: 'fail' } }),
          }),
        }
      }
      return {
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue(
              eventsOk ? { data: { id: 'test-id' }, error: null } : { data: null, error: { message: 'fail' } }
            ),
          }),
        }),
        delete: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }),
      }
    }),
  })
}

describe('GET /api/observability/health', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when no session', async () => {
    setupCookies()
    mockValidateAdminSession.mockResolvedValue(false)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns 401 when session is invalid', async () => {
    setupCookies('bad-token')
    mockValidateAdminSession.mockResolvedValue(false)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns health status with all ok', async () => {
    setupCookies('valid-token')
    mockValidateAdminSession.mockResolvedValue(true)
    setupSupabase(true, true)
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.supabase).toBe('ok')
    expect(body.logging_pipeline).toBe('ok')
    expect(body.timestamp).toBeDefined()
  })

  it('returns error status when supabase fails', async () => {
    setupCookies('valid-token')
    mockValidateAdminSession.mockResolvedValue(true)
    setupSupabase(false, false)
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.supabase).toBe('error')
    expect(body.logging_pipeline).toBe('error')
  })

  it('returns error status when service client throws', async () => {
    setupCookies('valid-token')
    mockValidateAdminSession.mockResolvedValue(true)
    mockCreateServiceClient.mockImplementation(() => { throw new Error('Connection failed') })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.supabase).toBe('error')
  })
})
