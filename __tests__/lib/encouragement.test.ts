import {
  getRandomFallback,
  detectMilestone,
  getTimeOfDay,
  FALLBACK_MESSAGES,
} from '@/lib/encouragement'

describe('getRandomFallback', () => {
  it('returns a non-empty string', () => {
    const result = getRandomFallback({ isMilestone: false, milestoneType: null, pointsEarned: 5 })
    expect(result).toBeTruthy()
    expect(typeof result).toBe('string')
  })

  it('returns a general message for normal completions', () => {
    const result = getRandomFallback({ isMilestone: false, milestoneType: null, pointsEarned: 5 })
    expect(FALLBACK_MESSAGES.general).toContain(result)
  })

  it('returns a points message when points earned >= 10', () => {
    const result = getRandomFallback({ isMilestone: false, milestoneType: null, pointsEarned: 10 })
    expect(FALLBACK_MESSAGES.points).toContain(result)
  })

  it('returns an all-done message for all-done milestones', () => {
    const result = getRandomFallback({ isMilestone: true, milestoneType: 'all-done', pointsEarned: 5 })
    expect(FALLBACK_MESSAGES['all-done']).toContain(result)
  })

  it('avoids recent messages when possible', () => {
    // Provide all but one general message as recent
    const allButLast = FALLBACK_MESSAGES.general.slice(0, -1)
    const result = getRandomFallback(
      { isMilestone: false, milestoneType: null, pointsEarned: 5 },
      allButLast
    )
    // Should pick the one not in recentMessages
    expect(result).toBe(FALLBACK_MESSAGES.general[FALLBACK_MESSAGES.general.length - 1])
  })

  it('falls back to full pool when all messages are recent', () => {
    const allGeneral = [...FALLBACK_MESSAGES.general]
    const result = getRandomFallback(
      { isMilestone: false, milestoneType: null, pointsEarned: 5 },
      allGeneral
    )
    // Should still return a message from the general pool
    expect(FALLBACK_MESSAGES.general).toContain(result)
  })

  it('prefers all-done over points category for milestone', () => {
    // Even with high points, all-done milestone takes priority
    const result = getRandomFallback({ isMilestone: true, milestoneType: 'all-done', pointsEarned: 20 })
    expect(FALLBACK_MESSAGES['all-done']).toContain(result)
  })

  it('returns points category for point milestone type', () => {
    // A point milestone with >= 10 points should return points category
    const result = getRandomFallback({ isMilestone: true, milestoneType: '100-points', pointsEarned: 10 })
    expect(FALLBACK_MESSAGES.points).toContain(result)
  })
})

describe('detectMilestone', () => {
  it('detects "all done" when all tasks are completed', () => {
    const result = detectMilestone({
      totalPoints: 30,
      pointsEarned: 10,
      completionsToday: 3,
      totalTasksToday: 3,
    })
    expect(result.isMilestone).toBe(true)
    expect(result.milestoneType).toBe('all-done')
  })

  it('detects 50-point milestone', () => {
    const result = detectMilestone({
      totalPoints: 55,
      pointsEarned: 10,
      completionsToday: 1,
      totalTasksToday: 5,
    })
    expect(result.isMilestone).toBe(true)
    expect(result.milestoneType).toBe('50-points')
  })

  it('detects 100-point milestone', () => {
    const result = detectMilestone({
      totalPoints: 100,
      pointsEarned: 5,
      completionsToday: 1,
      totalTasksToday: 5,
    })
    expect(result.isMilestone).toBe(true)
    expect(result.milestoneType).toBe('100-points')
  })

  it('detects 250-point milestone', () => {
    const result = detectMilestone({
      totalPoints: 260,
      pointsEarned: 15,
      completionsToday: 1,
      totalTasksToday: 5,
    })
    expect(result.isMilestone).toBe(true)
    expect(result.milestoneType).toBe('250-points')
  })

  it('detects 500-point milestone', () => {
    const result = detectMilestone({
      totalPoints: 500,
      pointsEarned: 10,
      completionsToday: 1,
      totalTasksToday: 5,
    })
    expect(result.isMilestone).toBe(true)
    expect(result.milestoneType).toBe('500-points')
  })

  it('detects 1000-point milestone', () => {
    const result = detectMilestone({
      totalPoints: 1005,
      pointsEarned: 10,
      completionsToday: 1,
      totalTasksToday: 5,
    })
    expect(result.isMilestone).toBe(true)
    expect(result.milestoneType).toBe('1000-points')
  })

  it('returns false for normal completions (no milestone)', () => {
    const result = detectMilestone({
      totalPoints: 30,
      pointsEarned: 10,
      completionsToday: 1,
      totalTasksToday: 5,
    })
    expect(result.isMilestone).toBe(false)
    expect(result.milestoneType).toBeNull()
  })

  it('prioritizes all-done over point milestone', () => {
    // All done AND crossing 100 points - all-done should win
    const result = detectMilestone({
      totalPoints: 100,
      pointsEarned: 5,
      completionsToday: 3,
      totalTasksToday: 3,
    })
    expect(result.isMilestone).toBe(true)
    expect(result.milestoneType).toBe('all-done')
  })

  it('returns false when totalTasksToday is 0', () => {
    const result = detectMilestone({
      totalPoints: 10,
      pointsEarned: 5,
      completionsToday: 0,
      totalTasksToday: 0,
    })
    expect(result.isMilestone).toBe(false)
  })
})

describe('getTimeOfDay', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('returns morning for 8 AM', () => {
    jest.setSystemTime(new Date(2024, 0, 15, 8, 0, 0))
    expect(getTimeOfDay()).toBe('morning')
  })

  it('returns morning for 5 AM', () => {
    jest.setSystemTime(new Date(2024, 0, 15, 5, 0, 0))
    expect(getTimeOfDay()).toBe('morning')
  })

  it('returns afternoon for 12 PM (noon)', () => {
    jest.setSystemTime(new Date(2024, 0, 15, 12, 0, 0))
    expect(getTimeOfDay()).toBe('afternoon')
  })

  it('returns afternoon for 3 PM', () => {
    jest.setSystemTime(new Date(2024, 0, 15, 15, 0, 0))
    expect(getTimeOfDay()).toBe('afternoon')
  })

  it('returns evening for 5 PM', () => {
    jest.setSystemTime(new Date(2024, 0, 15, 17, 0, 0))
    expect(getTimeOfDay()).toBe('evening')
  })

  it('returns evening for 8 PM', () => {
    jest.setSystemTime(new Date(2024, 0, 15, 20, 0, 0))
    expect(getTimeOfDay()).toBe('evening')
  })

  it('returns night for 9 PM', () => {
    jest.setSystemTime(new Date(2024, 0, 15, 21, 0, 0))
    expect(getTimeOfDay()).toBe('night')
  })

  it('returns night for 3 AM', () => {
    jest.setSystemTime(new Date(2024, 0, 15, 3, 0, 0))
    expect(getTimeOfDay()).toBe('night')
  })

  it('returns night for midnight', () => {
    jest.setSystemTime(new Date(2024, 0, 15, 0, 0, 0))
    expect(getTimeOfDay()).toBe('night')
  })
})
