import type { Profile } from '@/lib/types'

export interface QuestPrefill {
  title: string
  description: string
  points: number
  time_of_day: string
  recurring: string | null
  assigned_to: string | null
}

export interface ParseQuestResponse {
  prefill: QuestPrefill | null
  error?: string
}

export const VALID_POINTS = [5, 10, 15, 20, 25, 50] as const

/**
 * Snaps a numeric value to the nearest valid option.
 * Used to coerce AI-extracted point values to the valid enum.
 */
export function snapToNearest(value: number, options: readonly number[]): number {
  if (options.length === 0) return value

  let closest = options[0]
  let minDist = Math.abs(value - closest)

  for (let i = 1; i < options.length; i++) {
    const dist = Math.abs(value - options[i])
    if (dist < minDist) {
      minDist = dist
      closest = options[i]
    }
  }

  return closest
}

/**
 * Matches an AI-extracted name string to a family member UUID.
 * Uses a three-tier fallback: exact → prefix → substring (all case-insensitive).
 */
export function matchAssignee(
  name: string | null | undefined,
  members: Pick<Profile, 'id' | 'display_name' | 'nickname'>[]
): string | null {
  if (!name || members.length === 0) return null

  const lower = name.toLowerCase()

  // Exact match against display_name or nickname
  for (const m of members) {
    if (m.display_name.toLowerCase() === lower) return m.id
    if (m.nickname && m.nickname.toLowerCase() === lower) return m.id
  }

  // Prefix match
  for (const m of members) {
    if (m.display_name.toLowerCase().startsWith(lower)) return m.id
    if (m.nickname && m.nickname.toLowerCase().startsWith(lower)) return m.id
  }

  // Substring match
  for (const m of members) {
    if (m.display_name.toLowerCase().includes(lower)) return m.id
    if (m.nickname && m.nickname.toLowerCase().includes(lower)) return m.id
  }

  return null
}
