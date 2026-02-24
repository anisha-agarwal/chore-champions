import {
  STREAK_MILESTONES,
  getNextMilestone,
  getClaimableMilestones,
  formatStreakCount,
} from '@/lib/streaks'

describe('STREAK_MILESTONES', () => {
  it('has 5 milestones in ascending order', () => {
    expect(STREAK_MILESTONES).toHaveLength(5)
    for (let i = 1; i < STREAK_MILESTONES.length; i++) {
      expect(STREAK_MILESTONES[i].days).toBeGreaterThan(STREAK_MILESTONES[i - 1].days)
    }
  })

  it('has correct values', () => {
    expect(STREAK_MILESTONES[0]).toEqual({ days: 7, bonus: 50, badge: 'Week Warrior' })
    expect(STREAK_MILESTONES[1]).toEqual({ days: 14, bonus: 100, badge: 'Fortnight Fighter' })
    expect(STREAK_MILESTONES[2]).toEqual({ days: 30, bonus: 250, badge: 'Monthly Master' })
    expect(STREAK_MILESTONES[3]).toEqual({ days: 60, bonus: 500, badge: 'Sixty-Day Sage' })
    expect(STREAK_MILESTONES[4]).toEqual({ days: 100, bonus: 1000, badge: 'Century Champion' })
  })
})

describe('getNextMilestone', () => {
  it('returns 7-day milestone when streak is 0 and nothing claimed', () => {
    const result = getNextMilestone(0, [])
    expect(result).toEqual({ days: 7, bonus: 50, badge: 'Week Warrior' })
  })

  it('returns 7-day milestone when streak is 5', () => {
    const result = getNextMilestone(5, [])
    expect(result).toEqual({ days: 7, bonus: 50, badge: 'Week Warrior' })
  })

  it('returns 14-day milestone when 7-day is claimed and streak is 10', () => {
    const result = getNextMilestone(10, [7])
    expect(result).toEqual({ days: 14, bonus: 100, badge: 'Fortnight Fighter' })
  })

  it('skips claimed milestones', () => {
    const result = getNextMilestone(5, [7])
    expect(result).toEqual({ days: 14, bonus: 100, badge: 'Fortnight Fighter' })
  })

  it('returns null when all milestones are claimed', () => {
    const result = getNextMilestone(200, [7, 14, 30, 60, 100])
    expect(result).toBeNull()
  })

  it('returns null when streak exceeds all unclaimed milestones', () => {
    const result = getNextMilestone(200, [])
    expect(result).toBeNull()
  })

  it('returns 30-day milestone when 7 and 14 are claimed', () => {
    const result = getNextMilestone(20, [7, 14])
    expect(result).toEqual({ days: 30, bonus: 250, badge: 'Monthly Master' })
  })
})

describe('getClaimableMilestones', () => {
  it('returns empty array when streak is 0', () => {
    expect(getClaimableMilestones(0, [])).toEqual([])
  })

  it('returns 7-day milestone when streak is 7', () => {
    const result = getClaimableMilestones(7, [])
    expect(result).toEqual([{ days: 7, bonus: 50, badge: 'Week Warrior' }])
  })

  it('returns multiple milestones when streak is high', () => {
    const result = getClaimableMilestones(30, [])
    expect(result).toHaveLength(3)
    expect(result.map((m) => m.days)).toEqual([7, 14, 30])
  })

  it('excludes already claimed milestones', () => {
    const result = getClaimableMilestones(30, [7, 14])
    expect(result).toHaveLength(1)
    expect(result[0].days).toBe(30)
  })

  it('returns empty when all eligible are claimed', () => {
    const result = getClaimableMilestones(30, [7, 14, 30])
    expect(result).toEqual([])
  })

  it('returns all milestones at 100 days with none claimed', () => {
    const result = getClaimableMilestones(100, [])
    expect(result).toHaveLength(5)
  })
})

describe('formatStreakCount', () => {
  it('returns "1 day" for 1', () => {
    expect(formatStreakCount(1)).toBe('1 day')
  })

  it('returns "0 days" for 0', () => {
    expect(formatStreakCount(0)).toBe('0 days')
  })

  it('returns "7 days" for 7', () => {
    expect(formatStreakCount(7)).toBe('7 days')
  })

  it('returns "100 days" for 100', () => {
    expect(formatStreakCount(100)).toBe('100 days')
  })
})
