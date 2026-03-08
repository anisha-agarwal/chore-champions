/**
 * @jest-environment node
 */
jest.mock('@/lib/observability/error-logger', () => ({ logError: jest.fn() }))
jest.mock('@/lib/observability/event-tracker', () => ({ trackEvent: jest.fn() }))
jest.mock('@/lib/observability/ingest-validation', () => ({
  ...jest.requireActual('@/lib/observability/ingest-validation'),
  validateIngestPayload: jest.fn(),
}))

import { POST } from '@/app/api/observability/ingest/route'
import { NextRequest } from 'next/server'
import { logError } from '@/lib/observability/error-logger'
import { trackEvent } from '@/lib/observability/event-tracker'
import { validateIngestPayload } from '@/lib/observability/ingest-validation'

const mockLogError = logError as jest.Mock
const mockTrackEvent = trackEvent as jest.Mock
const mockValidate = validateIngestPayload as jest.Mock

const VALID_TOKEN = 'test-ingest-token'

function makeRequest(body: unknown, token?: string, contentLength?: string): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token !== undefined) headers['x-obs-token'] = token
  if (contentLength !== undefined) headers['content-length'] = contentLength
  return new NextRequest('http://localhost/api/observability/ingest', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

describe('POST /api/observability/ingest', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv, NEXT_PUBLIC_OBSERVABILITY_INGEST_TOKEN: VALID_TOKEN }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('returns 403 when token is missing', async () => {
    const req = makeRequest({ type: 'event', data: { event_type: 'page_view' } })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('returns 403 when token is wrong', async () => {
    const req = makeRequest({ type: 'event', data: { event_type: 'page_view' } }, 'wrong-token')
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('returns 403 when INGEST_TOKEN env var is not set', async () => {
    delete process.env.NEXT_PUBLIC_OBSERVABILITY_INGEST_TOKEN
    const req = makeRequest({}, VALID_TOKEN)
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('returns 413 when content-length exceeds limit', async () => {
    const req = makeRequest({}, VALID_TOKEN, (9 * 1024).toString())
    const res = await POST(req)
    expect(res.status).toBe(413)
  })

  it('returns 400 for invalid JSON', async () => {
    const req = new NextRequest('http://localhost/api/observability/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-obs-token': VALID_TOKEN },
      body: 'not-valid-json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when validation fails', async () => {
    mockValidate.mockReturnValueOnce({ ok: false, error: 'invalid event_type', status: 400 })
    const req = makeRequest({ type: 'event', data: {} }, VALID_TOKEN)
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('processes error payload and calls logError', async () => {
    mockValidate.mockReturnValueOnce({
      ok: true,
      payload: { type: 'error', data: { error_message: 'err', error_type: 'api', route: '/api/test' } },
    })
    const req = makeRequest({ type: 'error', data: {} }, VALID_TOKEN)
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockLogError).toHaveBeenCalled()
  })

  it('processes event payload and calls trackEvent', async () => {
    mockValidate.mockReturnValueOnce({ ok: true, payload: { type: 'event', data: { event_type: 'page_view' } } })
    const req = makeRequest({ type: 'event', data: {} }, VALID_TOKEN)
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockTrackEvent).toHaveBeenCalled()
  })

  it('processes batch payload', async () => {
    mockValidate.mockReturnValueOnce({
      ok: true,
      payload: {
        type: 'batch',
        items: [
          { type: 'event', data: { event_type: 'page_view' } },
          { type: 'error', data: { error_message: 'err', error_type: 'api', route: '/test' } },
        ],
      },
    })
    const req = makeRequest({ type: 'batch', items: [] }, VALID_TOKEN)
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockTrackEvent).toHaveBeenCalledTimes(1)
    expect(mockLogError).toHaveBeenCalledTimes(1)
  })

  it('handles unknown payload type gracefully (no-op)', async () => {
    mockValidate.mockReturnValueOnce({
      ok: true,
      payload: { type: 'unknown' },
    })
    const req = makeRequest({ type: 'unknown' }, VALID_TOKEN)
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockLogError).not.toHaveBeenCalled()
    expect(mockTrackEvent).not.toHaveBeenCalled()
  })

  it('returns 413 when body exceeds size limit', async () => {
    mockValidate.mockReturnValueOnce({ ok: true, payload: { type: 'event', data: { event_type: 'page_view' } } })
    const largeBody = JSON.stringify({ type: 'event', data: { event_type: 'page_view', extra: 'x'.repeat(9000) } })
    const req = new NextRequest('http://localhost/api/observability/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-obs-token': VALID_TOKEN },
      body: largeBody,
    })
    const res = await POST(req)
    expect(res.status).toBe(413)
  })
})
