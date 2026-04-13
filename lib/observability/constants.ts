// Event and error type constants — validated at app layer, not DB

export const APP_EVENT_TYPES = [
  'task_completed',
  'reward_claimed',
  'family_joined',
  'streak_milestone',
  'ai_insight_generated',
  'ai_encouragement_generated',
  'ai_quest_parsed',
  'ai_parent_chat_message',
  'ai_kid_chat_message',
  'ai_chat_conversation_created',
  'api_request',
  'rpc_call',
  'page_view',
  'health_probe',
  'push_subscription_created',
  'push_subscription_deleted',
  'push_notification_sent',
  'push_notification_failed',
] as const

export type AppEventType = typeof APP_EVENT_TYPES[number]

export const APP_ERROR_TYPES = ['rpc', 'api', 'client', 'boundary', 'middleware'] as const
export type AppErrorType = typeof APP_ERROR_TYPES[number]

// Rate limiting for admin auth
export const ADMIN_RATE_LIMIT_WINDOW_MINUTES = 1
export const ADMIN_RATE_LIMIT_MAX_ATTEMPTS = 5

// Payload size limits for ingest endpoint
export const INGEST_MAX_PAYLOAD_BYTES = 8 * 1024 // 8KB
export const INGEST_MAX_BATCH_ITEMS = 20

// Allowlist for metadata keys — unknown keys are stripped during sanitization
export const ALLOWED_METADATA_KEYS = new Set([
  'route',
  'rpcName',
  'taskName',
  'points',
  'rewardName',
  'cost',
  'familyId',
  'streakType',
  'days',
  'badge',
  'role',
  'path',
  'status',
  'method',
  'error',
  'errorCode',
  'componentStack',
  'conversationId',
  'streamDurationMs',
  'responseLength',
  'notificationType',
  'subscriberCount',
  'failureReason',
])

export const METADATA_MAX_BYTES = 10 * 1024 // 10KB per metadata object

// Admin session cookie name
export const ADMIN_SESSION_COOKIE = 'admin_obs_session'

// Admin session duration
export const ADMIN_SESSION_DURATION_HOURS = 24
