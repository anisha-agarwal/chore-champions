/**
 * @jest-environment node
 */

const mockFetch = jest.fn()
global.fetch = mockFetch

// Must mock before importing the module under test
jest.mock('../../e2e/test-constants', () => ({
  SUPABASE_PROJECT_REF: 'test-project-ref',
}))

import { runSQL, ensureAuthUser } from '../../e2e/supabase-admin'

describe('supabase-admin', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = {
      ...originalEnv,
      SUPABASE_ACCESS_TOKEN: 'test-access-token',
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('runSQL', () => {
    it('sends SQL query to Management API with correct headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ id: '123' }]),
      })

      const result = await runSQL('SELECT 1')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.supabase.com/v1/projects/test-project-ref/database/query',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-access-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: 'SELECT 1' }),
        }
      )
      expect(result).toEqual([{ id: '123' }])
    })

    it('throws if SUPABASE_ACCESS_TOKEN is not set', async () => {
      delete process.env.SUPABASE_ACCESS_TOKEN

      await expect(runSQL('SELECT 1')).rejects.toThrow(
        'SUPABASE_ACCESS_TOKEN not set'
      )
    })

    it('throws with status and body on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad request'),
      })

      await expect(runSQL('INVALID SQL')).rejects.toThrow(
        'SQL query failed (400): Bad request'
      )
    })
  })

  describe('ensureAuthUser', () => {
    it('returns existing user ID if user already exists', async () => {
      // runSQL call to check existing user
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ id: 'existing-user-id' }]),
      })

      const id = await ensureAuthUser('test@example.com', 'pass123', 'Test')

      expect(id).toBe('existing-user-id')
      // Only one fetch call (the runSQL check), no GoTrue call
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('creates user via GoTrue Admin API if not exists', async () => {
      // runSQL returns empty (no existing user)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      })
      // GoTrue Admin API creates user
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'new-user-id' }),
      })

      const id = await ensureAuthUser('new@example.com', 'pass123', 'New User')

      expect(id).toBe('new-user-id')
      expect(mockFetch).toHaveBeenCalledTimes(2)

      // Verify GoTrue call
      const goTrueCall = mockFetch.mock.calls[1]
      expect(goTrueCall[0]).toBe('https://test.supabase.co/auth/v1/admin/users')
      expect(goTrueCall[1]).toMatchObject({
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-service-role-key',
          'apikey': 'test-service-role-key',
          'Content-Type': 'application/json',
        },
      })

      const body = JSON.parse(goTrueCall[1].body)
      expect(body).toEqual({
        email: 'new@example.com',
        password: 'pass123',
        email_confirm: true,
        user_metadata: { display_name: 'New User' },
      })
    })

    it('throws if env vars are missing', async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL

      await expect(
        ensureAuthUser('test@example.com', 'pass', 'Test')
      ).rejects.toThrow('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required')
    })

    it('throws on GoTrue API failure', async () => {
      // runSQL returns empty
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      })
      // GoTrue fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        text: () => Promise.resolve('User already registered'),
      })

      await expect(
        ensureAuthUser('dup@example.com', 'pass', 'Dup')
      ).rejects.toThrow('Failed to create user dup@example.com: User already registered')
    })
  })
})
