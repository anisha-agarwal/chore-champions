import type { NextRequest } from 'next/server'

/**
 * Reads the x-request-start-ms header set by middleware.
 * Returns null if the header is missing or invalid.
 */
export function getRequestStartMs(request: NextRequest | Request): number | null {
  const header = (request as NextRequest).headers?.get('x-request-start-ms')
  if (!header) return null
  const parsed = parseInt(header, 10)
  if (isNaN(parsed)) return null
  return parsed
}

/**
 * Computes duration in ms from the request start timestamp.
 * Returns null if the start time is unavailable.
 */
export function computeDuration(startMs: number | null): number | null {
  if (startMs === null) return null
  return Date.now() - startMs
}
