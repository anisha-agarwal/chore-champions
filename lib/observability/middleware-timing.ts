import { NextResponse, type NextRequest } from 'next/server'
import { logError } from './error-logger'
import { trackEvent } from './event-tracker'
import { getRequestStartMs, computeDuration } from './server-timing'

type RouteHandler = (request: NextRequest, context?: unknown) => Promise<NextResponse>

/**
 * Wraps an API route handler with observability:
 * - Reads x-request-start-ms header to compute duration
 * - Fire-and-forget: tracks api_request event on success
 * - Fire-and-forget: logs error and re-throws on failure
 */
export function withObservability(handler: RouteHandler): RouteHandler {
  return async function wrappedHandler(request: NextRequest, context?: unknown): Promise<NextResponse> {
    const startMs = getRequestStartMs(request)
    const route = new URL(request.url).pathname

    try {
      const response = await handler(request, context)

      const durationMs = computeDuration(startMs)
      trackEvent({
        event_type: 'api_request',
        metadata: {
          route,
          method: request.method,
          status: response.status,
        },
        duration_ms: durationMs ?? undefined,
      })

      return response
    } catch (err) {
      const durationMs = computeDuration(startMs)
      const message = err instanceof Error ? err.message : String(err)

      logError({
        error_message: message,
        error_type: 'api',
        route,
        method: request.method,
        metadata: { durationMs },
      })

      throw err
    }
  }
}
