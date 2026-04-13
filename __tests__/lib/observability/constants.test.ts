import {
  APP_EVENT_TYPES,
  APP_ERROR_TYPES,
  ADMIN_RATE_LIMIT_WINDOW_MINUTES,
  ADMIN_RATE_LIMIT_MAX_ATTEMPTS,
  INGEST_MAX_PAYLOAD_BYTES,
  INGEST_MAX_BATCH_ITEMS,
  ALLOWED_METADATA_KEYS,
  METADATA_MAX_BYTES,
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_DURATION_HOURS,
} from '@/lib/observability/constants'

describe('observability constants', () => {
  it('APP_EVENT_TYPES contains expected values', () => {
    expect(APP_EVENT_TYPES).toContain('task_completed')
    expect(APP_EVENT_TYPES).toContain('api_request')
    expect(APP_EVENT_TYPES).toContain('rpc_call')
    expect(APP_EVENT_TYPES).toContain('page_view')
    expect(APP_EVENT_TYPES).toContain('health_probe')
  })

  it('APP_EVENT_TYPES contains push notification events', () => {
    expect(APP_EVENT_TYPES).toContain('push_subscription_created')
    expect(APP_EVENT_TYPES).toContain('push_subscription_deleted')
    expect(APP_EVENT_TYPES).toContain('push_notification_sent')
    expect(APP_EVENT_TYPES).toContain('push_notification_failed')
  })

  it('APP_ERROR_TYPES contains expected values', () => {
    expect(APP_ERROR_TYPES).toContain('rpc')
    expect(APP_ERROR_TYPES).toContain('api')
    expect(APP_ERROR_TYPES).toContain('client')
    expect(APP_ERROR_TYPES).toContain('boundary')
    expect(APP_ERROR_TYPES).toContain('middleware')
  })

  it('rate limit constants are defined', () => {
    expect(ADMIN_RATE_LIMIT_WINDOW_MINUTES).toBeGreaterThan(0)
    expect(ADMIN_RATE_LIMIT_MAX_ATTEMPTS).toBeGreaterThan(0)
  })

  it('ingest limits are defined', () => {
    expect(INGEST_MAX_PAYLOAD_BYTES).toBeGreaterThan(0)
    expect(INGEST_MAX_BATCH_ITEMS).toBeGreaterThan(0)
  })

  it('ALLOWED_METADATA_KEYS is a Set with expected keys', () => {
    expect(ALLOWED_METADATA_KEYS).toBeInstanceOf(Set)
    expect(ALLOWED_METADATA_KEYS.has('route')).toBe(true)
    expect(ALLOWED_METADATA_KEYS.has('rpcName')).toBe(true)
    expect(ALLOWED_METADATA_KEYS.has('taskName')).toBe(true)
  })

  it('ALLOWED_METADATA_KEYS includes push notification metadata', () => {
    expect(ALLOWED_METADATA_KEYS.has('notificationType')).toBe(true)
    expect(ALLOWED_METADATA_KEYS.has('subscriberCount')).toBe(true)
    expect(ALLOWED_METADATA_KEYS.has('failureReason')).toBe(true)
  })

  it('METADATA_MAX_BYTES is defined', () => {
    expect(METADATA_MAX_BYTES).toBeGreaterThan(0)
  })

  it('ADMIN_SESSION_COOKIE is defined', () => {
    expect(typeof ADMIN_SESSION_COOKIE).toBe('string')
    expect(ADMIN_SESSION_COOKIE.length).toBeGreaterThan(0)
  })

  it('ADMIN_SESSION_DURATION_HOURS is 24', () => {
    expect(ADMIN_SESSION_DURATION_HOURS).toBe(24)
  })
})
