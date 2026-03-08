import { ADMIN_SESSION_DURATION_HOURS } from './constants'

// All crypto uses SubtleCrypto (Web Crypto API) — Edge Runtime compatible

const encoder = new TextEncoder()
const decoder = new TextDecoder()

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

async function hmacSign(key: CryptoKey, data: string): Promise<string> {
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data))
  return Buffer.from(sig).toString('base64url')
}

/**
 * Derives a session version from the current password.
 * Changing the password invalidates all existing sessions.
 */
async function getSessionVersion(secret: string, password: string): Promise<string> {
  const key = await importHmacKey(secret)
  const full = await hmacSign(key, `version:${password}`)
  return full.slice(0, 8)
}

/**
 * Timing-safe string comparison to prevent timing attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still compare to avoid timing leak from length
    let diff = 0
    const maxLen = Math.max(a.length, b.length)
    for (let i = 0; i < maxLen; i++) {
      diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
    }
    return diff === 0 && a.length === b.length
  }
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

/**
 * Verifies the submitted password against the env var.
 */
export function verifyAdminPassword(submitted: string): boolean {
  const expected = process.env.ADMIN_OBSERVABILITY_PASSWORD
  if (!expected) return false
  return timingSafeEqual(submitted, expected)
}

/**
 * Creates a signed admin session token.
 * Token payload: { exp, v } where v is a version derived from HMAC(secret, password).
 * Changing the password changes the version, invalidating all sessions.
 */
export async function createAdminSession(): Promise<string> {
  const secret = process.env.ADMIN_SESSION_SECRET
  const password = process.env.ADMIN_OBSERVABILITY_PASSWORD
  if (!secret || !password) throw new Error('Admin session env vars not configured')

  const exp = Date.now() + ADMIN_SESSION_DURATION_HOURS * 60 * 60 * 1000
  const v = await getSessionVersion(secret, password)
  const payload = JSON.stringify({ exp, v })
  const b64 = Buffer.from(payload).toString('base64url')

  const key = await importHmacKey(secret)
  const sig = await hmacSign(key, b64)

  return `${b64}.${sig}`
}

/**
 * Validates an admin session token.
 * Returns true if the token is valid and not expired.
 */
export async function validateAdminSession(token: string): Promise<boolean> {
  const secret = process.env.ADMIN_SESSION_SECRET
  const password = process.env.ADMIN_OBSERVABILITY_PASSWORD
  if (!secret || !password) return false

  const parts = token.split('.')
  if (parts.length !== 2) return false
  const [b64, sig] = parts

  // Verify signature
  const key = await importHmacKey(secret)
  const expectedSig = await hmacSign(key, b64)
  if (!timingSafeEqual(sig, expectedSig)) return false

  // Decode payload
  let payload: { exp: number; v: string }
  try {
    payload = JSON.parse(decoder.decode(Buffer.from(b64, 'base64url')))
  } catch {
    return false
  }

  // Check expiry
  if (payload.exp < Date.now()) return false

  // Check version (password rotation invalidation)
  const expectedV = await getSessionVersion(secret, password)
  if (!timingSafeEqual(payload.v, expectedV)) return false

  return true
}
