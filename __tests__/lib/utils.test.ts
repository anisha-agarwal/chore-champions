import {
  cn,
  formatDate,
  getStartOfWeek,
  getWeekDays,
  isSameDay,
  toDateString,
  getInitials,
  generateInviteCode,
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
