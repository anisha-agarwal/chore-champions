/**
 * @jest-environment node
 */
import { GET } from '@/app/auth/callback/route'

// Mock Supabase server client
const mockExchangeCodeForSession = jest.fn()
jest.mock('@/lib/supabase/server', () => ({
  createClient: () => Promise.resolve({
    auth: {
      exchangeCodeForSession: mockExchangeCodeForSession,
    },
  }),
}))

describe('Auth Callback Route', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('exchanges code for session and redirects to /quests by default', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null })

    const request = new Request('http://localhost:3000/auth/callback?code=test-code')
    const response = await GET(request)

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('test-code')
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/quests')
  })

  it('redirects to specified next URL on success', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null })

    const request = new Request('http://localhost:3000/auth/callback?code=test-code&next=/family')
    const response = await GET(request)

    expect(response.headers.get('location')).toBe('http://localhost:3000/family')
  })

  it('redirects to login with error when code is missing', async () => {
    const request = new Request('http://localhost:3000/auth/callback')
    const response = await GET(request)

    expect(mockExchangeCodeForSession).not.toHaveBeenCalled()
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/login?error=auth_failed')
  })

  it('redirects to login with error when exchange fails', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: { message: 'Exchange failed' } })

    const request = new Request('http://localhost:3000/auth/callback?code=bad-code')
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/login?error=auth_failed')
  })
})
