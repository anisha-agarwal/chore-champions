/**
 * @jest-environment node
 */
jest.mock('@/lib/observability/error-logger', () => ({ logError: jest.fn() }))
jest.mock('@/lib/observability/event-tracker', () => ({ trackEvent: jest.fn() }))

import { withObservability } from '@/lib/observability/middleware-timing'
import { NextRequest, NextResponse } from 'next/server'
import { logError } from '@/lib/observability/error-logger'
import { trackEvent } from '@/lib/observability/event-tracker'

const mockLogError = logError as jest.Mock
const mockTrackEvent = trackEvent as jest.Mock

function makeRequest(url = 'http://localhost/api/test', startMs?: number): NextRequest {
  const headers: Record<string, string> = {}
  if (startMs !== undefined) {
    headers['x-request-start-ms'] = startMs.toString()
  }
  return new NextRequest(url, { headers })
}

describe('withObservability', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('calls the handler and returns its response', async () => {
    const handler = jest.fn().mockResolvedValue(NextResponse.json({ ok: true }, { status: 200 }))
    const wrapped = withObservability(handler)
    const req = makeRequest('http://localhost/api/test', Date.now() - 50)

    const response = await wrapped(req)

    expect(handler).toHaveBeenCalledWith(req, undefined)
    expect(response.status).toBe(200)
  })

  it('tracks api_request event on success', async () => {
    const handler = jest.fn().mockResolvedValue(NextResponse.json({}, { status: 200 }))
    const wrapped = withObservability(handler)
    const req = makeRequest('http://localhost/api/test', Date.now() - 50)

    await wrapped(req)

    expect(mockTrackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'api_request',
        metadata: expect.objectContaining({ route: '/api/test', method: 'GET' }),
      })
    )
  })

  it('tracks event even without x-request-start-ms header', async () => {
    const handler = jest.fn().mockResolvedValue(NextResponse.json({}, { status: 200 }))
    const wrapped = withObservability(handler)
    const req = makeRequest('http://localhost/api/test')

    await wrapped(req)

    expect(mockTrackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'api_request',
        duration_ms: undefined,
      })
    )
  })

  it('logs error and re-throws when handler throws', async () => {
    const handler = jest.fn().mockRejectedValue(new Error('handler failed'))
    const wrapped = withObservability(handler)
    const req = makeRequest('http://localhost/api/broken', Date.now() - 10)

    await expect(wrapped(req)).rejects.toThrow('handler failed')

    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({
        error_message: 'handler failed',
        error_type: 'api',
        route: '/api/broken',
      })
    )
  })

  it('logs non-Error throws as strings', async () => {
    const handler = jest.fn().mockRejectedValue('string error')
    const wrapped = withObservability(handler)
    const req = makeRequest('http://localhost/api/test')

    await expect(wrapped(req)).rejects.toBe('string error')

    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({ error_message: 'string error' })
    )
  })
})
