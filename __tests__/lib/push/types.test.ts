import {
  NOTIFICATION_TYPES,
  DEFAULT_TYPES_ENABLED,
  isNotificationType,
} from '@/lib/push/types'

describe('NOTIFICATION_TYPES', () => {
  it('exposes the expected set of types', () => {
    expect(NOTIFICATION_TYPES).toEqual(['task_completed', 'streak_milestone', 'test'])
  })
})

describe('DEFAULT_TYPES_ENABLED', () => {
  it('defaults every notification type to enabled', () => {
    for (const t of NOTIFICATION_TYPES) {
      expect(DEFAULT_TYPES_ENABLED[t]).toBe(true)
    }
  })

  it('has exactly one key per NOTIFICATION_TYPES entry', () => {
    expect(Object.keys(DEFAULT_TYPES_ENABLED).sort()).toEqual([...NOTIFICATION_TYPES].sort())
  })
})

describe('isNotificationType', () => {
  it('accepts known types', () => {
    expect(isNotificationType('task_completed')).toBe(true)
    expect(isNotificationType('streak_milestone')).toBe(true)
    expect(isNotificationType('test')).toBe(true)
  })

  it('rejects unknown strings', () => {
    expect(isNotificationType('bogus')).toBe(false)
    expect(isNotificationType('')).toBe(false)
  })

  it('rejects non-string values', () => {
    expect(isNotificationType(null)).toBe(false)
    expect(isNotificationType(undefined)).toBe(false)
    expect(isNotificationType(42)).toBe(false)
    expect(isNotificationType({})).toBe(false)
    expect(isNotificationType(['task_completed'])).toBe(false)
  })
})
