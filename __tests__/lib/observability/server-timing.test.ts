/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { getRequestStartMs, computeDuration } from '@/lib/observability/server-timing'

function makeRequest(headers: Record<string, string>): NextRequest {
  return new NextRequest('http://localhost/api/test', { headers })
}

describe('getRequestStartMs', () => {
  it('returns null when header is missing', () => {
    const req = makeRequest({})
    expect(getRequestStartMs(req)).toBeNull()
  })

  it('returns parsed timestamp when header is present', () => {
    const now = Date.now()
    const req = makeRequest({ 'x-request-start-ms': now.toString() })
    expect(getRequestStartMs(req)).toBe(now)
  })

  it('returns null for invalid header value', () => {
    const req = makeRequest({ 'x-request-start-ms': 'not-a-number' })
    expect(getRequestStartMs(req)).toBeNull()
  })
})

describe('computeDuration', () => {
  it('returns null when startMs is null', () => {
    expect(computeDuration(null)).toBeNull()
  })

  it('returns non-negative duration', () => {
    const start = Date.now() - 100
    const duration = computeDuration(start)
    expect(duration).toBeGreaterThanOrEqual(100)
  })
})
