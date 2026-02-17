import {
  cn,
  formatDate,
  getStartOfWeek,
  getWeekDays,
  isSameDay,
  toDateString,
  getInitials,
  generateInviteCode,
  combineDateAndTime,
  formatTime,
  getTimeRemaining,
  formatTimeRemaining,
  toTimeString,
  isInAppBrowser,
} from '@/lib/utils'

describe('cn (classnames utility)', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz')
  })

  it('merges tailwind classes correctly', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })
})

describe('formatDate', () => {
  it('formats a date object', () => {
    const date = new Date(2024, 0, 15) // Month is 0-indexed
    const formatted = formatDate(date)
    expect(formatted).toContain('Jan')
    expect(formatted).toContain('15')
  })

  it('formats a date string', () => {
    const date = new Date(2024, 5, 20) // June 20, 2024
    const formatted = formatDate(date)
    expect(formatted).toContain('Jun')
    expect(formatted).toContain('20')
  })
})

describe('getStartOfWeek', () => {
  it('returns Sunday for a mid-week date', () => {
    const wednesday = new Date('2024-01-17') // Wednesday
    const sunday = getStartOfWeek(wednesday)
    expect(sunday.getDay()).toBe(0) // Sunday
    expect(sunday.getDate()).toBe(14)
  })

  it('returns same day if already Sunday', () => {
    const sunday = new Date(2024, 0, 14) // January 14, 2024 is a Sunday
    const result = getStartOfWeek(sunday)
    expect(result.getDay()).toBe(0) // Sunday
  })
})

describe('getWeekDays', () => {
  it('returns 7 days', () => {
    const days = getWeekDays(new Date('2024-01-15'))
    expect(days).toHaveLength(7)
  })

  it('starts with Sunday', () => {
    const days = getWeekDays(new Date('2024-01-17'))
    expect(days[0].getDay()).toBe(0) // Sunday
  })

  it('ends with Saturday', () => {
    const days = getWeekDays(new Date('2024-01-17'))
    expect(days[6].getDay()).toBe(6) // Saturday
  })
})

describe('isSameDay', () => {
  it('returns true for same day', () => {
    const date1 = new Date('2024-01-15T10:00:00')
    const date2 = new Date('2024-01-15T20:00:00')
    expect(isSameDay(date1, date2)).toBe(true)
  })

  it('returns false for different days', () => {
    const date1 = new Date('2024-01-15')
    const date2 = new Date('2024-01-16')
    expect(isSameDay(date1, date2)).toBe(false)
  })
})

describe('toDateString', () => {
  it('formats date as YYYY-MM-DD', () => {
    const date = new Date('2024-01-15T12:00:00Z')
    expect(toDateString(date)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('getInitials', () => {
  it('returns initials for full name', () => {
    expect(getInitials('John Doe')).toBe('JD')
  })

  it('returns single initial for single name', () => {
    expect(getInitials('John')).toBe('J')
  })

  it('returns max 2 initials for long names', () => {
    expect(getInitials('John Michael Doe')).toBe('JM')
  })

  it('handles lowercase', () => {
    expect(getInitials('john doe')).toBe('JD')
  })
})

describe('generateInviteCode', () => {
  it('returns 8 character string', () => {
    const code = generateInviteCode()
    expect(code).toHaveLength(8)
  })

  it('returns uppercase string', () => {
    const code = generateInviteCode()
    expect(code).toBe(code.toUpperCase())
  })

  it('generates unique codes', () => {
    const codes = new Set()
    for (let i = 0; i < 100; i++) {
      codes.add(generateInviteCode())
    }
    expect(codes.size).toBe(100)
  })
})

describe('combineDateAndTime', () => {
  it('combines date and time into a Date object', () => {
    const result = combineDateAndTime('2024-01-15', '14:30:00')
    expect(result.getFullYear()).toBe(2024)
    expect(result.getMonth()).toBe(0) // January
    expect(result.getDate()).toBe(15)
    expect(result.getHours()).toBe(14)
    expect(result.getMinutes()).toBe(30)
    expect(result.getSeconds()).toBe(0)
  })

  it('handles midnight', () => {
    const result = combineDateAndTime('2024-06-01', '00:00:00')
    expect(result.getHours()).toBe(0)
    expect(result.getMinutes()).toBe(0)
  })

  it('handles end of day', () => {
    const result = combineDateAndTime('2024-06-01', '23:59:00')
    expect(result.getHours()).toBe(23)
    expect(result.getMinutes()).toBe(59)
  })

  it('handles time without seconds', () => {
    const result = combineDateAndTime('2024-01-15', '14:30')
    expect(result.getHours()).toBe(14)
    expect(result.getMinutes()).toBe(30)
  })
})

describe('formatTime', () => {
  it('formats afternoon time', () => {
    expect(formatTime('14:30:00')).toBe('2:30 PM')
  })

  it('formats morning time', () => {
    expect(formatTime('09:15:00')).toBe('9:15 AM')
  })

  it('formats noon', () => {
    expect(formatTime('12:00:00')).toBe('12:00 PM')
  })

  it('formats midnight', () => {
    expect(formatTime('00:00:00')).toBe('12:00 AM')
  })

  it('formats 1 AM', () => {
    expect(formatTime('01:00:00')).toBe('1:00 AM')
  })

  it('formats 11 PM', () => {
    expect(formatTime('23:45:00')).toBe('11:45 PM')
  })
})

describe('getTimeRemaining', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('returns positive time remaining for future deadline', () => {
    jest.setSystemTime(new Date('2024-01-15T12:00:00'))
    const deadline = new Date('2024-01-15T14:30:00')
    const result = getTimeRemaining(deadline)

    expect(result.isOverdue).toBe(false)
    expect(result.isWarning).toBe(false)
    expect(result.hours).toBe(2)
    expect(result.minutes).toBe(30)
    expect(result.totalMinutes).toBe(150)
  })

  it('returns warning when within 60 minutes', () => {
    jest.setSystemTime(new Date('2024-01-15T13:45:00'))
    const deadline = new Date('2024-01-15T14:30:00')
    const result = getTimeRemaining(deadline)

    expect(result.isOverdue).toBe(false)
    expect(result.isWarning).toBe(true)
    expect(result.hours).toBe(0)
    expect(result.minutes).toBe(45)
  })

  it('returns warning at exactly 60 minutes', () => {
    jest.setSystemTime(new Date('2024-01-15T13:30:00'))
    const deadline = new Date('2024-01-15T14:30:00')
    const result = getTimeRemaining(deadline)

    expect(result.isOverdue).toBe(false)
    expect(result.isWarning).toBe(true)
    expect(result.totalMinutes).toBe(60)
  })

  it('returns overdue for past deadline', () => {
    jest.setSystemTime(new Date('2024-01-15T15:30:00'))
    const deadline = new Date('2024-01-15T14:30:00')
    const result = getTimeRemaining(deadline)

    expect(result.isOverdue).toBe(true)
    expect(result.isWarning).toBe(false)
    expect(result.hours).toBe(1)
    expect(result.minutes).toBe(0)
  })

  it('returns overdue at zero remaining', () => {
    jest.setSystemTime(new Date('2024-01-15T14:30:01'))
    const deadline = new Date('2024-01-15T14:30:00')
    const result = getTimeRemaining(deadline)

    expect(result.isOverdue).toBe(true)
  })
})

describe('formatTimeRemaining', () => {
  it('formats hours and minutes remaining', () => {
    expect(formatTimeRemaining({ hours: 2, minutes: 15, isOverdue: false })).toBe('2h 15m left')
  })

  it('formats minutes only remaining', () => {
    expect(formatTimeRemaining({ hours: 0, minutes: 45, isOverdue: false })).toBe('45m left')
  })

  it('formats hours only remaining', () => {
    expect(formatTimeRemaining({ hours: 3, minutes: 0, isOverdue: false })).toBe('3h left')
  })

  it('formats overdue with hours and minutes', () => {
    expect(formatTimeRemaining({ hours: 1, minutes: 30, isOverdue: true })).toBe('1h 30m overdue')
  })

  it('formats overdue with minutes only', () => {
    expect(formatTimeRemaining({ hours: 0, minutes: 15, isOverdue: true })).toBe('15m overdue')
  })

  it('formats zero time remaining', () => {
    expect(formatTimeRemaining({ hours: 0, minutes: 0, isOverdue: false })).toBe('0m left')
  })
})

describe('toTimeString', () => {
  it('converts HH:MM to HH:MM:SS', () => {
    expect(toTimeString('14:30')).toBe('14:30:00')
  })

  it('passes through HH:MM:SS unchanged', () => {
    expect(toTimeString('14:30:00')).toBe('14:30:00')
  })

  it('converts midnight correctly', () => {
    expect(toTimeString('00:00')).toBe('00:00:00')
  })

  it('converts end of day correctly', () => {
    expect(toTimeString('23:59')).toBe('23:59:00')
  })
})

describe('isInAppBrowser', () => {
  it('detects Facebook in-app browser', () => {
    expect(isInAppBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) FBAN/FBIOS')).toBe(true)
    expect(isInAppBrowser('Mozilla/5.0 (Linux; Android 13) FBAV/400.0')).toBe(true)
  })

  it('detects Instagram in-app browser', () => {
    expect(isInAppBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) Instagram 275.0')).toBe(true)
  })

  it('detects WhatsApp in-app browser', () => {
    expect(isInAppBrowser('Mozilla/5.0 (Linux; Android 13) WhatsApp/2.23')).toBe(true)
  })

  it('detects LinkedIn in-app browser', () => {
    expect(isInAppBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) LinkedInApp')).toBe(true)
  })

  it('detects WeChat in-app browser', () => {
    expect(isInAppBrowser('Mozilla/5.0 (Linux; Android 13) MicroMessenger/8.0')).toBe(true)
  })

  it('returns false for Safari', () => {
    expect(isInAppBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1')).toBe(false)
  })

  it('returns false for Chrome', () => {
    expect(isInAppBrowser('Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isInAppBrowser('')).toBe(false)
  })
})
