import { createServiceClient } from './service-client'
import type { AppEventType } from './constants'
import { APP_EVENT_TYPES } from './constants'

export interface TrackEventParams {
  event_type: AppEventType
  user_id?: string
  family_id?: string
  metadata?: Record<string, unknown>
  duration_ms?: number
}

/**
 * Fire-and-forget event tracker. Never throws. Never blocks the request path.
 * Uses service-role client to bypass RLS.
 */
export function trackEvent(params: TrackEventParams): void {
  if (!APP_EVENT_TYPES.includes(params.event_type)) {
    /* istanbul ignore next */
    if (process.env.NODE_ENV === 'development') {
      console.warn('[observability] Unknown event_type:', params.event_type)
    }
    return
  }

  void (async () => {
    try {
      const supabase = createServiceClient()
      await supabase.from('app_events').insert({
        event_type: params.event_type,
        user_id: params.user_id ?? null,
        family_id: params.family_id ?? null,
        metadata: params.metadata ?? {},
        duration_ms: params.duration_ms ?? null,
      })
    } catch (err) {
      /* istanbul ignore next */
      if (process.env.NODE_ENV === 'development') {
        console.warn('[observability] trackEvent failed:', err)
      }
    }
  })()
}
