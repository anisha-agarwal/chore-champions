/**
 * @jest-environment node
 */

// The global jest.setup.ts mocks @/lib/supabase/client. We need to undo that.
// We test the actual module factory functions here.

// Mock @supabase/ssr before importing
const mockCreateBrowserClient = jest.fn().mockReturnValue({ mock: 'browser-client' })
const mockCreateServerClient = jest.fn().mockReturnValue({ mock: 'server-client' })

jest.mock('@supabase/ssr', () => ({
  createBrowserClient: mockCreateBrowserClient,
  createServerClient: mockCreateServerClient,
}))

// Mock next/headers
const mockCookieStore = {
  getAll: jest.fn().mockReturnValue([]),
  set: jest.fn(),
}
jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue(mockCookieStore),
}))

// Unmock the client module so we test the real implementation
jest.unmock('@/lib/supabase/client')

// Set required env vars
const originalEnv = process.env
beforeAll(() => {
  process.env = {
    ...originalEnv,
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
  }
})

afterAll(() => {
  process.env = originalEnv
})

/* eslint-disable @typescript-eslint/no-require-imports */
describe('Supabase Clients', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Browser Client', () => {
    it('calls createBrowserClient with env vars', () => {
      const { createClient } = require('@/lib/supabase/client')
      createClient()

      expect(mockCreateBrowserClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test-anon-key'
      )
    })

    it('returns the client from createBrowserClient', () => {
      const { createClient } = require('@/lib/supabase/client')
      const client = createClient()
      expect(client).toEqual({ mock: 'browser-client' })
    })
  })

  describe('Server Client', () => {
    it('calls createServerClient with env vars and cookie config', async () => {
      const { createClient } = require('@/lib/supabase/server')
      await createClient()

      expect(mockCreateServerClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test-anon-key',
        expect.objectContaining({
          cookies: expect.objectContaining({
            getAll: expect.any(Function),
            setAll: expect.any(Function),
          }),
        })
      )
    })

    it('returns the client from createServerClient', async () => {
      const { createClient } = require('@/lib/supabase/server')
      const client = await createClient()
      expect(client).toEqual({ mock: 'server-client' })
    })

    it('cookie getAll reads from cookie store', async () => {
      const { createClient } = require('@/lib/supabase/server')
      await createClient()

      const cookiesConfig = mockCreateServerClient.mock.calls[0][2].cookies

      cookiesConfig.getAll()
      expect(mockCookieStore.getAll).toHaveBeenCalled()
    })

    it('cookie setAll sets cookies on the cookie store', async () => {
      const { createClient } = require('@/lib/supabase/server')
      await createClient()

      const cookiesConfig = mockCreateServerClient.mock.calls[0][2].cookies

      cookiesConfig.setAll([
        { name: 'test-cookie', value: 'value', options: { path: '/' } },
      ])
      expect(mockCookieStore.set).toHaveBeenCalledWith('test-cookie', 'value', { path: '/' })
    })

    it('cookie setAll does not throw from Server Components', async () => {
      mockCookieStore.set.mockImplementation(() => {
        throw new Error('Cannot set cookies in Server Components')
      })

      const { createClient } = require('@/lib/supabase/server')
      await createClient()

      const cookiesConfig = mockCreateServerClient.mock.calls[0][2].cookies

      expect(() => {
        cookiesConfig.setAll([
          { name: 'test-cookie', value: 'value', options: {} },
        ])
      }).not.toThrow()
    })
  })
})
