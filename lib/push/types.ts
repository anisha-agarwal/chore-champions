export const NOTIFICATION_TYPES = ['task_completed', 'streak_milestone', 'test'] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export function isNotificationType(value: unknown): value is NotificationType {
  return typeof value === 'string' && (NOTIFICATION_TYPES as readonly string[]).includes(value)
}

export type TypesEnabled = Record<NotificationType, boolean>

export const DEFAULT_TYPES_ENABLED: TypesEnabled = {
  task_completed: true,
  streak_milestone: true,
  test: true,
}

export interface NotificationPreferences {
  user_id: string
  push_enabled: boolean
  types_enabled: TypesEnabled
  quiet_hours_start: number | null
  quiet_hours_end: number | null
  timezone: string
  updated_at: string
}

export interface NotificationPreferencesPatch {
  push_enabled?: boolean
  types_enabled?: Partial<TypesEnabled>
  quiet_hours_start?: number | null
  quiet_hours_end?: number | null
  timezone?: string
}
