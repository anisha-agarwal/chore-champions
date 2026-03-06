import { LEVELS } from './analytics-constants'
import type { DailyPoint, KidAnalytics, FamilyAnalytics, Level, UserStreaks, BadgeInfo } from './types'

export function getCurrentLevel(points: number): Level {
  // Walk backwards through sorted levels to find the highest tier reached
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (points >= LEVELS[i].minPoints) {
      return LEVELS[i]
    }
  }
  return LEVELS[0]
}

export function getLevelProgress(
  points: number
): { current: Level; next: Level | null; progress: number } {
  const current = getCurrentLevel(points)
  const nextIndex = LEVELS.findIndex((l) => l.level === current.level) + 1
  const next = nextIndex < LEVELS.length ? LEVELS[nextIndex] : null

  if (!next) {
    return { current, next: null, progress: 1 }
  }

  // progress = (points - current.minPoints) / (next.minPoints - current.minPoints)
  // e.g. 150 points, current=Explorer(100), next=Champion(300) → (150-100)/(300-100) = 0.25
  const progress = (points - current.minPoints) / (next.minPoints - current.minPoints)
  return { current, next, progress: Math.min(1, Math.max(0, progress)) }
}

export function filterDailyPoints(heatmap: DailyPoint[], weeks: number): DailyPoint[] {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - weeks * 7)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  return heatmap.filter((d) => d.date >= cutoffStr)
}

export function aggregateByWeek(
  daily: DailyPoint[]
): { week: string; points: number; completions: number }[] {
  const map = new Map<string, { points: number; completions: number }>()

  for (const d of daily) {
    const date = new Date(d.date + 'T00:00:00')
    // Find Sunday of this week
    const dow = date.getDay() // 0=Sun
    const sunday = new Date(date)
    sunday.setDate(date.getDate() - dow)
    const weekKey = sunday.toISOString().slice(0, 10)

    const existing = map.get(weekKey) ?? { points: 0, completions: 0 }
    map.set(weekKey, {
      points: existing.points + d.points,
      completions: existing.completions + d.completions,
    })
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, v]) => ({ week, ...v }))
}

export function aggregateByMonth(
  daily: DailyPoint[]
): { month: string; points: number; completions: number }[] {
  const map = new Map<string, { points: number; completions: number }>()

  for (const d of daily) {
    const monthKey = d.date.slice(0, 7) // YYYY-MM
    const existing = map.get(monthKey) ?? { points: 0, completions: 0 }
    map.set(monthKey, {
      points: existing.points + d.points,
      completions: existing.completions + d.completions,
    })
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, ...v }))
}

export function getHeatmapIntensity(completions: number, max: number): number {
  if (completions === 0 || max === 0) return 0
  // Map to 1-4 (0 reserved for empty)
  const ratio = completions / max
  if (ratio <= 0.25) return 1
  if (ratio <= 0.5) return 2
  if (ratio <= 0.75) return 3
  return 4
}

export function formatCompletionDelta(
  thisWeek: number,
  lastWeek: number
): { delta: number; direction: 'up' | 'down' | 'same'; percentage: number } {
  const delta = thisWeek - lastWeek
  const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'same'
  // percentage change: delta / lastWeek * 100, or 100% if lastWeek was 0 and thisWeek > 0
  const percentage =
    lastWeek === 0
      ? thisWeek > 0
        ? 100
        : 0
      : Math.abs(Math.round((delta / lastWeek) * 100))
  return { delta, direction, percentage }
}

export function generateStaticSummary(
  stats: KidAnalytics | FamilyAnalytics,
  role: 'parent' | 'child'
): string {
  if (role === 'child') {
    const kidStats = stats as KidAnalytics
    const { completions_this_week, completions_last_week, total_points } = kidStats
    if (completions_this_week === 0) {
      return "You haven't completed any quests this week yet. Check your quest list and start earning points!"
    }
    const delta = completions_this_week - completions_last_week
    const trend =
      delta > 0
        ? `That's ${delta} more than last week — great improvement!`
        : delta < 0
          ? `You can do even better next week!`
          : "Same as last week — keep it up!"
    return `You completed ${completions_this_week} quest${completions_this_week !== 1 ? 's' : ''} this week and have ${total_points} total points. ${trend}`
  }

  // parent
  const familyStats = stats as FamilyAnalytics
  const { children, family_completion_rate } = familyStats
  const rate = Math.round(family_completion_rate * 100)
  if (children.length === 0) {
    return 'No children in your family yet. Invite your kids to start tracking their progress.'
  }
  const topChild = [...children].sort((a, b) => b.completions_this_week - a.completions_this_week)[0]
  const topName = topChild?.profile.nickname ?? topChild?.profile.display_name ?? 'A child'
  return `Your family completed ${rate}% of eligible quests this week. ${topName} led the way with ${topChild?.completions_this_week ?? 0} completions.`
}

export function getBadgeProgress(badge: BadgeInfo, streaks: UserStreaks): number {
  if (badge.claimed_at) return 1.0

  let currentStreak = 0
  if (badge.streak_type === 'active_day') {
    currentStreak = streaks.active_day_streak
  } else if (badge.streak_type === 'perfect_day') {
    currentStreak = streaks.perfect_day_streak
  } else if (badge.streak_type === 'task' && badge.task_id) {
    const taskStreak = streaks.task_streaks.find((t) => t.task_id === badge.task_id)
    currentStreak = taskStreak?.current_streak ?? 0
  }

  // progress = currentStreak / milestone_days, clamped to [0, 1]
  return Math.min(1, Math.max(0, currentStreak / badge.milestone_days))
}

export function getCurrentWeekStart(): string {
  const today = new Date()
  const dow = today.getDay() // 0=Sun
  const sunday = new Date(today)
  sunday.setDate(today.getDate() - dow)
  // Use local date parts (not toISOString which is UTC) to avoid timezone day-shift
  const y = sunday.getFullYear()
  const m = String(sunday.getMonth() + 1).padStart(2, '0')
  const d = String(sunday.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
