/**
 * @jest-environment node
 */
import { verifyAdminPassword, createAdminSession, validateAdminSession } from '@/lib/observability/admin-auth'

const ORIGINAL_ENV = process.env

beforeEach(() => {
  jest.resetModules()
  process.env = { ...ORIGINAL_ENV }
  process.env.ADMIN_OBSERVABILITY_PASSWORD = 'test-password-123'
  process.env.ADMIN_SESSION_SECRET = 'a'.repeat(64)
})

afterEach(() => {
  process.env = ORIGINAL_ENV
})

describe('verifyAdminPassword', () => {
  it('returns true for correct password', () => {
    expect(verifyAdminPassword('test-password-123')).toBe(true)
  })

  it('returns false for wrong password', () => {
    expect(verifyAdminPassword('wrong-password')).toBe(false)
  })

  it('returns false when env var is not set', () => {
    delete process.env.ADMIN_OBSERVABILITY_PASSWORD
    expect(verifyAdminPassword('test-password-123')).toBe(false)
  })

  it('is timing-safe for different length strings', () => {
    // Should not throw, just return false
    expect(verifyAdminPassword('short')).toBe(false)
    expect(verifyAdminPassword('this-is-a-very-long-wrong-password-attempt')).toBe(false)
  })
})

describe('createAdminSession + validateAdminSession', () => {
  it('creates a valid session that validates', async () => {
    const token = await createAdminSession()
    expect(typeof token).toBe('string')
    expect(token).toContain('.')

    const isValid = await validateAdminSession(token)
    expect(isValid).toBe(true)
  })

  it('returns false for malformed token', async () => {
    expect(await validateAdminSession('not-valid')).toBe(false)
    expect(await validateAdminSession('')).toBe(false)
    expect(await validateAdminSession('a.b.c')).toBe(false)
  })

  it('returns false for tampered signature', async () => {
    const token = await createAdminSession()
    const [payload] = token.split('.')
    const tampered = `${payload}.invalidsignature`
    expect(await validateAdminSession(tampered)).toBe(false)
  })

  it('returns false when env vars are missing', async () => {
    delete process.env.ADMIN_SESSION_SECRET
    expect(await validateAdminSession('some.token')).toBe(false)
  })

  it('returns false when password changes (session version invalidation)', async () => {
    const token = await createAdminSession()
    process.env.ADMIN_OBSERVABILITY_PASSWORD = 'new-password-456'
    expect(await validateAdminSession(token)).toBe(false)
  })

  it('throws when env vars missing for createAdminSession', async () => {
    delete process.env.ADMIN_SESSION_SECRET
    await expect(createAdminSession()).rejects.toThrow()
  })

  it('returns false for token with invalid base64 payload', async () => {
    // Create a valid signature structure but with non-JSON payload
    const secret = process.env.ADMIN_SESSION_SECRET!
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const badPayload = Buffer.from('not-valid-json').toString('base64url')
    const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(badPayload))
    const sig = Buffer.from(sigBuffer).toString('base64url')
    const token = `${badPayload}.${sig}`

    expect(await validateAdminSession(token)).toBe(false)
  })
})
