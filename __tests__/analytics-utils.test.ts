import {
  getCurrentLevel,
  getLevelProgress,
  filterDailyPoints,
  aggregateByWeek,
  aggregateByMonth,
  getHeatmapIntensity,
  formatCompletionDelta,
  generateStaticSummary,
  getBadgeProgress,
  getCurrentWeekStart,
} from '@/lib/analytics-utils'
import type { DailyPoint, KidAnalytics, FamilyAnalytics, BadgeInfo, UserStreaks } from '@/lib/types'

describe('getCurrentLevel', () => {
  it('returns Rookie for 0 points', () => {
    expect(getCurrentLevel(0)).toMatchObject({ level: 1, name: 'Rookie' })
  })

  it('returns Rookie for 99 points', () => {
    expect(getCurrentLevel(99)).toMatchObject({ level: 1, name: 'Rookie' })
  })

  it('returns Explorer at exactly 100 points', () => {
    expect(getCurrentLevel(100)).toMatchObject({ level: 2, name: 'Explorer' })
  })

  it('returns Champion at 300 points', () => {
    expect(getCurrentLevel(300)).toMatchObject({ level: 3, name: 'Champion' })
  })

  it('returns Hero at 600 points', () => {
    expect(getCurrentLevel(600)).toMatchObject({ level: 4, name: 'Hero' })
  })

  it('returns Legend at 1000+ points', () => {
    expect(getCurrentLevel(1000)).toMatchObject({ level: 5, name: 'Legend' })
    expect(getCurrentLevel(9999)).toMatchObject({ level: 5, name: 'Legend' })
  })

  it('handles negative points gracefully', () => {
    expect(getCurrentLevel(-5)).toMatchObject({ level: 1, name: 'Rookie' })
  })
})

describe('getLevelProgress', () => {
  it('returns progress=0 at level start', () => {
    const result = getLevelProgress(0)
    expect(result.current.name).toBe('Rookie')
    expect(result.next?.name).toBe('Explorer')
    expect(result.progress).toBe(0)
  })

  it('returns correct fraction mid-level', () => {
    // Explorer: 100-300, at 200 points → progress = (200-100)/(300-100) = 0.5
    const result = getLevelProgress(200)
    expect(result.current.name).toBe('Explorer')
    expect(result.next?.name).toBe('Champion')
    expect(result.progress).toBeCloseTo(0.5)
  })

  it('returns progress=1 at max level (Legend)', () => {
    const result = getLevelProgress(2000)
    expect(result.current.name).toBe('Legend')
    expect(result.next).toBeNull()
    expect(result.progress).toBe(1)
  })

  it('clamps progress to [0, 1]', () => {
    // Should not exceed 1 even at boundary
    const result = getLevelProgress(300)
    expect(result.progress).toBeLessThanOrEqual(1)
  })
})

describe('filterDailyPoints', () => {
  const today = new Date()
  const toIso = (daysAgo: number) => {
    const d = new Date(today)
    d.setDate(d.getDate() - daysAgo)
    return d.toISOString().slice(0, 10)
  }

  const heatmap: DailyPoint[] = [
    { date: toIso(400), points: 5, completions: 1 }, // very old
    { date: toIso(30), points: 10, completions: 2 },  // within 12 weeks
    { date: toIso(1), points: 20, completions: 3 },   // recent
  ]

  it('filters to last 4 weeks', () => {
    const result = filterDailyPoints(heatmap, 4)
    expect(result).toHaveLength(1)
    expect(result[0].date).toBe(toIso(1))
  })

  it('filters to last 12 weeks', () => {
    const result = filterDailyPoints(heatmap, 12)
    expect(result).toHaveLength(2)
  })

  it('returns all if weeks covers full range', () => {
    const result = filterDailyPoints(heatmap, 52)
    expect(result).toHaveLength(2) // 400 days ago is > 52 weeks (364 days)
  })

  it('returns empty array for empty input', () => {
    expect(filterDailyPoints([], 12)).toEqual([])
  })
})

describe('aggregateByWeek', () => {
  it('groups daily points into weekly totals', () => {
    // Monday & Tuesday of same week
    const monday = '2024-01-01' // Monday
    const tuesday = '2024-01-02' // Tuesday
    // Sunday of that week = 2023-12-31
    const data: DailyPoint[] = [
      { date: monday, points: 10, completions: 1 },
      { date: tuesday, points: 20, completions: 2 },
    ]
    const result = aggregateByWeek(data)
    expect(result).toHaveLength(1)
    expect(result[0].points).toBe(30)
    expect(result[0].completions).toBe(3)
    expect(result[0].week).toBe('2023-12-31') // Sunday
  })

  it('produces separate weeks for different weeks', () => {
    const data: DailyPoint[] = [
      { date: '2024-01-01', points: 10, completions: 1 }, // week of 2023-12-31
      { date: '2024-01-08', points: 20, completions: 2 }, // week of 2024-01-07
    ]
    const result = aggregateByWeek(data)
    expect(result).toHaveLength(2)
  })

  it('returns sorted results', () => {
    const data: DailyPoint[] = [
      { date: '2024-01-08', points: 20, completions: 2 },
      { date: '2024-01-01', points: 10, completions: 1 },
    ]
    const result = aggregateByWeek(data)
    expect(result[0].week < result[1].week).toBe(true)
  })

  it('returns empty array for empty input', () => {
    expect(aggregateByWeek([])).toEqual([])
  })
})

describe('aggregateByMonth', () => {
  it('groups by YYYY-MM', () => {
    const data: DailyPoint[] = [
      { date: '2024-01-05', points: 10, completions: 1 },
      { date: '2024-01-20', points: 15, completions: 2 },
      { date: '2024-02-01', points: 20, completions: 3 },
    ]
    const result = aggregateByMonth(data)
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ month: '2024-01', points: 25, completions: 3 })
    expect(result[1]).toMatchObject({ month: '2024-02', points: 20, completions: 3 })
  })

  it('returns sorted results', () => {
    const data: DailyPoint[] = [
      { date: '2024-03-01', points: 5, completions: 1 },
      { date: '2024-01-01', points: 10, completions: 1 },
    ]
    const result = aggregateByMonth(data)
    expect(result[0].month).toBe('2024-01')
    expect(result[1].month).toBe('2024-03')
  })

  it('returns empty array for empty input', () => {
    expect(aggregateByMonth([])).toEqual([])
  })
})

describe('getHeatmapIntensity', () => {
  it('returns 0 for zero completions', () => {
    expect(getHeatmapIntensity(0, 10)).toBe(0)
  })

  it('returns 0 when max is 0', () => {
    expect(getHeatmapIntensity(0, 0)).toBe(0)
  })

  it('returns 1 for low ratio (<=25%)', () => {
    expect(getHeatmapIntensity(1, 8)).toBe(1)  // 12.5%
    expect(getHeatmapIntensity(2, 8)).toBe(1)  // 25%
  })

  it('returns 2 for medium-low ratio (<=50%)', () => {
    expect(getHeatmapIntensity(3, 8)).toBe(2)  // 37.5%
    expect(getHeatmapIntensity(4, 8)).toBe(2)  // 50%
  })

  it('returns 3 for medium-high ratio (<=75%)', () => {
    expect(getHeatmapIntensity(5, 8)).toBe(3)  // 62.5%
    expect(getHeatmapIntensity(6, 8)).toBe(3)  // 75%
  })

  it('returns 4 for high ratio (>75%)', () => {
    expect(getHeatmapIntensity(7, 8)).toBe(4)  // 87.5%
    expect(getHeatmapIntensity(8, 8)).toBe(4)  // 100%
  })
})

describe('formatCompletionDelta', () => {
  it('reports up direction when this week > last week', () => {
    const result = formatCompletionDelta(10, 8)
    expect(result.direction).toBe('up')
    expect(result.delta).toBe(2)
    expect(result.percentage).toBe(25)
  })

  it('reports down direction when this week < last week', () => {
    const result = formatCompletionDelta(5, 10)
    expect(result.direction).toBe('down')
    expect(result.delta).toBe(-5)
    expect(result.percentage).toBe(50)
  })

  it('reports same when equal', () => {
    const result = formatCompletionDelta(7, 7)
    expect(result.direction).toBe('same')
    expect(result.delta).toBe(0)
    expect(result.percentage).toBe(0)
  })

  it('handles zero last week with completions this week as 100%', () => {
    const result = formatCompletionDelta(5, 0)
    expect(result.direction).toBe('up')
    expect(result.percentage).toBe(100)
  })

  it('handles both zero as same/0%', () => {
    const result = formatCompletionDelta(0, 0)
    expect(result.direction).toBe('same')
    expect(result.percentage).toBe(0)
  })
})

describe('generateStaticSummary', () => {
  const baseKidStats: KidAnalytics = {
    daily_points: [],
    task_breakdown: [],
    milestones: [],
    total_points: 150,
    completions_this_week: 5,
    completions_last_week: 3,
  }

  it('generates kid summary with completions', () => {
    const summary = generateStaticSummary(baseKidStats, 'child')
    expect(summary).toContain('5')
    expect(summary).toContain('150')
  })

  it('generates encouraging message for zero completions', () => {
    const stats = { ...baseKidStats, completions_this_week: 0 }
    const summary = generateStaticSummary(stats, 'child')
    expect(summary.toLowerCase()).toContain('quest')
  })

  it('generates parent summary with family data', () => {
    const familyStats: FamilyAnalytics = {
      children: [
        {
          profile: { id: '1', display_name: 'Alice', nickname: null, avatar_url: null, points: 100 },
          completions_this_week: 8,
          completions_last_week: 5,
          completion_rate: 0.8,
        },
      ],
      daily_totals: [],
      top_tasks: [],
      bottom_tasks: [],
      family_completion_rate: 0.75,
    }
    const summary = generateStaticSummary(familyStats, 'parent')
    expect(summary).toContain('75%')
    expect(summary).toContain('Alice')
  })

  it('generates declining message for child when delta < 0', () => {
    const stats = { ...baseKidStats, completions_this_week: 2, completions_last_week: 5 }
    const summary = generateStaticSummary(stats, 'child')
    expect(summary).toContain('You can do even better next week!')
  })

  it('generates steady message for child when delta === 0', () => {
    const stats = { ...baseKidStats, completions_this_week: 3, completions_last_week: 3 }
    const summary = generateStaticSummary(stats, 'child')
    expect(summary).toContain('Same as last week')
    expect(summary).toContain('keep it up')
  })

  it('uses singular "quest" for 1 completion', () => {
    const stats = { ...baseKidStats, completions_this_week: 1, completions_last_week: 0 }
    const summary = generateStaticSummary(stats, 'child')
    expect(summary).toContain('1 quest ')
    expect(summary).not.toContain('1 quests')
  })

  it('sorts multiple children to find the top performer', () => {
    const familyStats: FamilyAnalytics = {
      children: [
        {
          profile: { id: '1', display_name: 'Alice', nickname: null, avatar_url: null, points: 50 },
          completions_this_week: 3,
          completions_last_week: 2,
          completion_rate: 0.5,
        },
        {
          profile: { id: '2', display_name: 'Bob', nickname: null, avatar_url: null, points: 80 },
          completions_this_week: 10,
          completions_last_week: 7,
          completion_rate: 0.9,
        },
      ],
      daily_totals: [],
      top_tasks: [],
      bottom_tasks: [],
      family_completion_rate: 0.7,
    }
    const summary = generateStaticSummary(familyStats, 'parent')
    expect(summary).toContain('Bob')
    expect(summary).toContain('10 completions')
  })

  it('uses nickname when available for top child in parent summary', () => {
    const familyStats: FamilyAnalytics = {
      children: [
        {
          profile: { id: '1', display_name: 'Alice Lastname', nickname: 'Ali', avatar_url: null, points: 100 },
          completions_this_week: 8,
          completions_last_week: 5,
          completion_rate: 0.8,
        },
      ],
      daily_totals: [],
      top_tasks: [],
      bottom_tasks: [],
      family_completion_rate: 0.75,
    }
    const summary = generateStaticSummary(familyStats, 'parent')
    expect(summary).toContain('Ali')
    expect(summary).not.toContain('Alice Lastname')
  })

  it('falls back to "A child" when top child has no nickname or display_name', () => {
    const familyStats: FamilyAnalytics = {
      children: [
        {
          profile: { id: '1', display_name: null as unknown as string, nickname: null, avatar_url: null, points: 50 },
          completions_this_week: 3,
          completions_last_week: 2,
          completion_rate: 0.6,
        },
      ],
      daily_totals: [],
      top_tasks: [],
      bottom_tasks: [],
      family_completion_rate: 0.5,
    }
    const summary = generateStaticSummary(familyStats, 'parent')
    expect(summary).toContain('A child')
  })

  it('handles empty family gracefully', () => {
    const familyStats: FamilyAnalytics = {
      children: [],
      daily_totals: [],
      top_tasks: [],
      bottom_tasks: [],
      family_completion_rate: 0,
    }
    const summary = generateStaticSummary(familyStats, 'parent')
    expect(summary.toLowerCase()).toContain('no children')
  })
})

describe('getBadgeProgress', () => {
  const streaks: UserStreaks = {
    active_day_streak: 5,
    perfect_day_streak: 3,
    task_streaks: [{ task_id: 'task-1', title: 'Clean Room', current_streak: 4 }],
  }

  it('returns 1.0 for claimed badge', () => {
    const badge: BadgeInfo = {
      badge_name: 'Week Warrior',
      milestone_days: 7,
      streak_type: 'active_day',
      task_id: null,
      claimed_at: '2024-01-01',
    }
    expect(getBadgeProgress(badge, streaks)).toBe(1.0)
  })

  it('calculates progress for active_day streak', () => {
    const badge: BadgeInfo = {
      badge_name: 'Week Warrior',
      milestone_days: 10,
      streak_type: 'active_day',
      task_id: null,
      claimed_at: null,
    }
    // 5/10 = 0.5
    expect(getBadgeProgress(badge, streaks)).toBeCloseTo(0.5)
  })

  it('calculates progress for perfect_day streak', () => {
    const badge: BadgeInfo = {
      badge_name: 'Perfect Week',
      milestone_days: 6,
      streak_type: 'perfect_day',
      task_id: null,
      claimed_at: null,
    }
    // 3/6 = 0.5
    expect(getBadgeProgress(badge, streaks)).toBeCloseTo(0.5)
  })

  it('calculates progress for task streak', () => {
    const badge: BadgeInfo = {
      badge_name: 'Task Master',
      milestone_days: 8,
      streak_type: 'task',
      task_id: 'task-1',
      claimed_at: null,
    }
    // 4/8 = 0.5
    expect(getBadgeProgress(badge, streaks)).toBeCloseTo(0.5)
  })

  it('returns 0 for task streak when task not found', () => {
    const badge: BadgeInfo = {
      badge_name: 'Task Master',
      milestone_days: 7,
      streak_type: 'task',
      task_id: 'unknown-task',
      claimed_at: null,
    }
    expect(getBadgeProgress(badge, streaks)).toBe(0)
  })

  it('returns 0 for unmatched streak_type', () => {
    const badge: BadgeInfo = {
      badge_name: 'Unknown Type',
      milestone_days: 7,
      // Force an unmatched streak_type to cover the fallthrough branch
      streak_type: 'nonexistent' as BadgeInfo['streak_type'],
      task_id: null,
      claimed_at: null,
    }
    expect(getBadgeProgress(badge, streaks)).toBe(0)
  })

  it('clamps progress to max 1.0', () => {
    const badge: BadgeInfo = {
      badge_name: 'Overachiever',
      milestone_days: 3, // less than current streak of 5
      streak_type: 'active_day',
      task_id: null,
      claimed_at: null,
    }
    expect(getBadgeProgress(badge, streaks)).toBe(1)
  })
})

describe('getCurrentWeekStart', () => {
  it('returns a valid ISO date string', () => {
    const result = getCurrentWeekStart()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('returns a Sunday (day 0)', () => {
    const result = getCurrentWeekStart()
    const date = new Date(result + 'T00:00:00')
    expect(date.getDay()).toBe(0)
  })

  it('returns a date not in the future', () => {
    const result = getCurrentWeekStart()
    const today = new Date().toISOString().slice(0, 10)
    expect(result <= today).toBe(true)
  })

  it('returns a date within the last 7 days', () => {
    const result = getCurrentWeekStart()
    const today = new Date()
    const cutoff = new Date(today)
    cutoff.setDate(today.getDate() - 6)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    expect(result >= cutoffStr).toBe(true)
  })
})
