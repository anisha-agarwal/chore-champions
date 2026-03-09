import type { AppEventType, AppErrorType } from './constants'
import {
  APP_EVENT_TYPES,
  APP_ERROR_TYPES,
  ALLOWED_METADATA_KEYS,
  METADATA_MAX_BYTES,
  INGEST_MAX_BATCH_ITEMS,
} from './constants'

export interface IngestError {
  error_message: string
  error_type: AppErrorType
  route: string
  metadata?: Record<string, unknown>
}

export interface IngestEvent {
  event_type: AppEventType
  metadata?: Record<string, unknown>
  duration_ms?: number
}

export type IngestItem =
  | { type: 'error'; data: IngestError }
  | { type: 'event'; data: IngestEvent }

export type IngestPayload =
  | { type: 'error'; data: IngestError }
  | { type: 'event'; data: IngestEvent }
  | { type: 'batch'; items: IngestItem[] }

export interface ValidationResult {
  ok: true
  payload: IngestPayload
}

export interface ValidationError {
  ok: false
  error: string
  status: number
}

/**
 * Strips unknown keys from metadata and enforces byte-size cap.
 */
export function sanitizeMetadata(
  raw: unknown
): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}

  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (ALLOWED_METADATA_KEYS.has(key)) {
      result[key] = value
    }
  }

  // Enforce byte cap
  const serialized = JSON.stringify(result)
  if (Buffer.byteLength(serialized, 'utf8') > METADATA_MAX_BYTES) {
    return {}
  }

  return result
}

function validateErrorData(data: unknown): string | null {
  if (!data || typeof data !== 'object') return 'data must be an object'
  const d = data as Record<string, unknown>
  if (typeof d.error_message !== 'string' || !d.error_message) return 'error_message required'
  if (!APP_ERROR_TYPES.includes(d.error_type as AppErrorType)) return 'invalid error_type'
  if (typeof d.route !== 'string' || !d.route) return 'route required'
  return null
}

function validateEventData(data: unknown): string | null {
  if (!data || typeof data !== 'object') return 'data must be an object'
  const d = data as Record<string, unknown>
  if (!APP_EVENT_TYPES.includes(d.event_type as AppEventType)) return 'invalid event_type'
  return null
}

/**
 * Validates and sanitizes an ingest payload.
 */
export function validateIngestPayload(
  raw: unknown
): ValidationResult | ValidationError {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Invalid payload', status: 400 }
  }

  const obj = raw as Record<string, unknown>

  if (obj.type === 'error') {
    const err = validateErrorData(obj.data)
    if (err) return { ok: false, error: err, status: 400 }
    const d = obj.data as Record<string, unknown>
    return {
      ok: true,
      payload: {
        type: 'error',
        data: {
          error_message: String(d.error_message).slice(0, 1000),
          error_type: d.error_type as AppErrorType,
          route: String(d.route),
          metadata: sanitizeMetadata(d.metadata),
        },
      },
    }
  }

  if (obj.type === 'event') {
    const err = validateEventData(obj.data)
    if (err) return { ok: false, error: err, status: 400 }
    const d = obj.data as Record<string, unknown>
    return {
      ok: true,
      payload: {
        type: 'event',
        data: {
          event_type: d.event_type as AppEventType,
          metadata: sanitizeMetadata(d.metadata),
          duration_ms: typeof d.duration_ms === 'number' ? Math.floor(d.duration_ms) : undefined,
        },
      },
    }
  }

  if (obj.type === 'batch') {
    if (!Array.isArray(obj.items)) {
      return { ok: false, error: 'batch.items must be an array', status: 400 }
    }
    if (obj.items.length > INGEST_MAX_BATCH_ITEMS) {
      return { ok: false, error: `batch.items exceeds limit of ${INGEST_MAX_BATCH_ITEMS}`, status: 400 }
    }

    const items: IngestItem[] = []
    for (const item of obj.items) {
      if (!item || typeof item !== 'object') continue
      const i = item as Record<string, unknown>
      if (i.type === 'error') {
        const err = validateErrorData(i.data)
        if (err) continue
        const d = i.data as Record<string, unknown>
        items.push({
          type: 'error',
          data: {
            error_message: String(d.error_message).slice(0, 1000),
            error_type: d.error_type as AppErrorType,
            route: String(d.route),
            metadata: sanitizeMetadata(d.metadata),
          },
        })
      } else if (i.type === 'event') {
        const err = validateEventData(i.data)
        if (err) continue
        const d = i.data as Record<string, unknown>
        items.push({
          type: 'event',
          data: {
            event_type: d.event_type as AppEventType,
            metadata: sanitizeMetadata(d.metadata),
            duration_ms: typeof d.duration_ms === 'number' ? Math.floor(d.duration_ms) : undefined,
          },
        })
      }
    }

    return { ok: true, payload: { type: 'batch', items } }
  }

  return { ok: false, error: 'Unknown payload type', status: 400 }
}
