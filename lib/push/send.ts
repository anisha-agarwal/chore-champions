import webpush from 'web-push'
import { createServiceClient } from '@/lib/observability/service-client'
import { trackEvent } from '@/lib/observability/event-tracker'
import { isWithinQuietHours } from './quiet-hours'
import { DEFAULT_TYPES_ENABLED, type NotificationType, type TypesEnabled } from './types'

export interface PushPayload {
  type: NotificationType
  title: string
  body: string
  url?: string
  tag?: string
}

interface SubscriptionRow {
  id: string
  endpoint: string
  p256dh_key: string
  auth_key: string
}

interface PrefsRow {
  push_enabled: boolean
  types_enabled: unknown
  quiet_hours_start: number | null
  quiet_hours_end: number | null
  timezone: string
}

function getTypesEnabled(raw: unknown): TypesEnabled {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...DEFAULT_TYPES_ENABLED, ...(raw as Partial<TypesEnabled>) }
  }
  return { ...DEFAULT_TYPES_ENABLED }
}

export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<number> {
  const supabase = createServiceClient()

  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('push_enabled, types_enabled, quiet_hours_start, quiet_hours_end, timezone')
    .eq('user_id', userId)
    .maybeSingle()

  const effectivePrefs: PrefsRow = prefs ?? {
    push_enabled: true,
    types_enabled: DEFAULT_TYPES_ENABLED,
    quiet_hours_start: null,
    quiet_hours_end: null,
    timezone: 'UTC',
  }

  if (!effectivePrefs.push_enabled) return 0

  const typesEnabled = getTypesEnabled(effectivePrefs.types_enabled)
  if (!typesEnabled[payload.type]) return 0

  if (isWithinQuietHours(
    new Date(),
    effectivePrefs.quiet_hours_start,
    effectivePrefs.quiet_hours_end,
    effectivePrefs.timezone,
  )) return 0

  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh_key, auth_key')
    .eq('user_id', userId)

  if (!subscriptions || subscriptions.length === 0) return 0

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
  const vapidSubject = process.env.VAPID_SUBJECT

  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) return 0

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

  const pushPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? '/',
    tag: payload.tag ?? payload.type,
  })

  let sentCount = 0
  const results = await Promise.allSettled(
    (subscriptions as SubscriptionRow[]).map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh_key, auth: sub.auth_key },
          },
          pushPayload,
        )
        sentCount++
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode
        if (statusCode === 410 || statusCode === 404) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('id', sub.id)

          trackEvent({
            event_type: 'push_subscription_deleted',
            user_id: userId,
            metadata: { notificationType: payload.type, failureReason: `${statusCode} Gone` },
          })
        } else {
          trackEvent({
            event_type: 'push_notification_failed',
            user_id: userId,
            metadata: {
              notificationType: payload.type,
              failureReason: err instanceof Error ? err.message : String(err),
            },
          })
        }
      }
    }),
  )

  void results

  if (sentCount > 0) {
    trackEvent({
      event_type: 'push_notification_sent',
      user_id: userId,
      metadata: { notificationType: payload.type, subscriberCount: sentCount },
    })
  }

  return sentCount
}
