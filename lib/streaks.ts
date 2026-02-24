import type { StreakMilestone } from './types'

// Keep in sync with claim_streak_milestone() in supabase/migrations/012_streaks.sql
export const STREAK_MILESTONES: StreakMilestone[] = [
  { days: 7, bonus: 50, badge: 'Week Warrior' },
  { days: 14, bonus: 100, badge: 'Fortnight Fighter' },
  { days: 30, bonus: 250, badge: 'Monthly Master' },
  { days: 60, bonus: 500, badge: 'Sixty-Day Sage' },
  { days: 100, bonus: 1000, badge: 'Century Champion' },
]

export function getNextMilestone(
  currentStreak: number,
  claimedDays: number[]
): StreakMilestone | null {
  for (const milestone of STREAK_MILESTONES) {
    if (!claimedDays.includes(milestone.days) && currentStreak < milestone.days) {
      return milestone
    }
  }
  return null
}

export function getClaimableMilestones(
  currentStreak: number,
  claimedDays: number[]
): StreakMilestone[] {
  return STREAK_MILESTONES.filter(
    (m) => currentStreak >= m.days && !claimedDays.includes(m.days)
  )
}

export function formatStreakCount(n: number): string {
  return n === 1 ? '1 day' : `${n} days`
}
