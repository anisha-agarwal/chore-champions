import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withObservability } from '@/lib/observability/middleware-timing'
import {
  DEFAULT_TYPES_ENABLED,
  NOTIFICATION_TYPES,
  type NotificationPreferences,
  type NotificationType,
  type TypesEnabled,
} from '@/lib/push/types'

interface PrefsRow {
  user_id: string
  push_enabled: boolean
  types_enabled: unknown
  quiet_hours_start: number | null
  quiet_hours_end: number | null
  timezone: string
  updated_at: string
}

function normalizeTypesEnabled(raw: unknown): TypesEnabled {
  const merged: TypesEnabled = { ...DEFAULT_TYPES_ENABLED }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const type of NOTIFICATION_TYPES) {
      const value = (raw as Record<string, unknown>)[type]
      if (typeof value === 'boolean') {
        merged[type] = value
      }
    }
  }
  return merged
}

function rowToPreferences(row: PrefsRow): NotificationPreferences {
  return {
    user_id: row.user_id,
    push_enabled: row.push_enabled,
    types_enabled: normalizeTypesEnabled(row.types_enabled),
    quiet_hours_start: row.quiet_hours_start,
    quiet_hours_end: row.quiet_hours_end,
    timezone: row.timezone,
    updated_at: row.updated_at,
  }
}

async function getHandler(): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: existing, error: selectError } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (selectError) {
    return NextResponse.json({ error: 'Failed to load preferences' }, { status: 500 })
  }

  if (existing) {
    return NextResponse.json({ data: rowToPreferences(existing as PrefsRow) })
  }

  const { data: inserted, error: insertError } = await supabase
    .from('notification_preferences')
    .insert({ user_id: user.id })
    .select('*')
    .single()

  if (insertError || !inserted) {
    return NextResponse.json({ error: 'Failed to create preferences' }, { status: 500 })
  }

  return NextResponse.json({ data: rowToPreferences(inserted as PrefsRow) })
}

interface ValidatedPatch {
  push_enabled?: boolean
  types_enabled?: TypesEnabled
  quiet_hours_start?: number | null
  quiet_hours_end?: number | null
  timezone?: string
}

function isValidHour(value: unknown): value is number | null {
  if (value === null) return true
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 23
}

function isValidTimezone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return true
  } catch {
    return false
  }
}

function validatePatch(body: unknown): ValidatedPatch | { error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Invalid body' }
  }
  const input = body as Record<string, unknown>
  const patch: ValidatedPatch = {}

  if ('push_enabled' in input) {
    if (typeof input.push_enabled !== 'boolean') {
      return { error: 'push_enabled must be a boolean' }
    }
    patch.push_enabled = input.push_enabled
  }

  if ('types_enabled' in input) {
    const raw = input.types_enabled
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { error: 'types_enabled must be an object' }
    }
    const entries = raw as Record<string, unknown>
    for (const [key, value] of Object.entries(entries)) {
      if (!(NOTIFICATION_TYPES as readonly string[]).includes(key)) {
        return { error: `Unknown notification type: ${key}` }
      }
      if (typeof value !== 'boolean') {
        return { error: `types_enabled.${key} must be a boolean` }
      }
    }
    patch.types_enabled = entries as unknown as TypesEnabled
  }

  if ('quiet_hours_start' in input) {
    if (!isValidHour(input.quiet_hours_start)) {
      return { error: 'quiet_hours_start must be null or an integer 0-23' }
    }
    patch.quiet_hours_start = input.quiet_hours_start as number | null
  }

  if ('quiet_hours_end' in input) {
    if (!isValidHour(input.quiet_hours_end)) {
      return { error: 'quiet_hours_end must be null or an integer 0-23' }
    }
    patch.quiet_hours_end = input.quiet_hours_end as number | null
  }

  if ('timezone' in input) {
    if (!isValidTimezone(input.timezone)) {
      return { error: 'Invalid timezone' }
    }
    patch.timezone = input.timezone
  }

  return patch
}

async function patchHandler(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const result = validatePatch(body)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  const current: NotificationPreferences = existing
    ? rowToPreferences(existing as PrefsRow)
    : {
        user_id: user.id,
        push_enabled: true,
        types_enabled: { ...DEFAULT_TYPES_ENABLED },
        quiet_hours_start: null,
        quiet_hours_end: null,
        timezone: 'UTC',
        updated_at: new Date().toISOString(),
      }

  const mergedTypes: TypesEnabled = { ...current.types_enabled }
  if (result.types_enabled) {
    for (const type of NOTIFICATION_TYPES) {
      const value = result.types_enabled[type as NotificationType]
      if (typeof value === 'boolean') {
        mergedTypes[type as NotificationType] = value
      }
    }
  }

  const nextRow = {
    user_id: user.id,
    push_enabled: result.push_enabled ?? current.push_enabled,
    types_enabled: mergedTypes,
    quiet_hours_start:
      'quiet_hours_start' in result ? (result.quiet_hours_start ?? null) : current.quiet_hours_start,
    quiet_hours_end:
      'quiet_hours_end' in result ? (result.quiet_hours_end ?? null) : current.quiet_hours_end,
    timezone: result.timezone ?? current.timezone,
  }

  const { data: saved, error: saveError } = await supabase
    .from('notification_preferences')
    .upsert(nextRow, { onConflict: 'user_id' })
    .select('*')
    .single()

  if (saveError || !saved) {
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 })
  }

  return NextResponse.json({ data: rowToPreferences(saved as PrefsRow) })
}

export const GET = withObservability(getHandler)
export const PATCH = withObservability(patchHandler)
