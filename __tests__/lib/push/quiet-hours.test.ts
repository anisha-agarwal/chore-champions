import { isWithinQuietHours } from '@/lib/push/quiet-hours'

// Build a Date that represents a given UTC hour so we can reason about tz offsets.
function utcAt(year: number, month: number, day: number, hour: number): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, 0, 0))
}

describe('isWithinQuietHours', () => {
  const utc = 'UTC'

  it('returns false when startHour is null', () => {
    expect(isWithinQuietHours(utcAt(2026, 4, 11, 23), null, 7, utc)).toBe(false)
  })

  it('returns false when endHour is null', () => {
    expect(isWithinQuietHours(utcAt(2026, 4, 11, 23), 22, null, utc)).toBe(false)
  })

  it('returns false when both bounds are null', () => {
    expect(isWithinQuietHours(utcAt(2026, 4, 11, 23), null, null, utc)).toBe(false)
  })

  it('returns false when start equals end (empty window)', () => {
    expect(isWithinQuietHours(utcAt(2026, 4, 11, 9), 9, 9, utc)).toBe(false)
  })

  describe('same-day range (9→17)', () => {
    it('returns true at the start hour (inclusive)', () => {
      expect(isWithinQuietHours(utcAt(2026, 4, 11, 9), 9, 17, utc)).toBe(true)
    })

    it('returns true in the middle of the window', () => {
      expect(isWithinQuietHours(utcAt(2026, 4, 11, 13), 9, 17, utc)).toBe(true)
    })

    it('returns false at the end hour (exclusive)', () => {
      expect(isWithinQuietHours(utcAt(2026, 4, 11, 17), 9, 17, utc)).toBe(false)
    })

    it('returns false before the window', () => {
      expect(isWithinQuietHours(utcAt(2026, 4, 11, 8), 9, 17, utc)).toBe(false)
    })

    it('returns false after the window', () => {
      expect(isWithinQuietHours(utcAt(2026, 4, 11, 20), 9, 17, utc)).toBe(false)
    })
  })

  describe('overnight range (22→7)', () => {
    it('returns true at start (22:00)', () => {
      expect(isWithinQuietHours(utcAt(2026, 4, 11, 22), 22, 7, utc)).toBe(true)
    })

    it('returns true at 23:00 (before midnight)', () => {
      expect(isWithinQuietHours(utcAt(2026, 4, 11, 23), 22, 7, utc)).toBe(true)
    })

    it('returns true at 03:00 (after midnight)', () => {
      expect(isWithinQuietHours(utcAt(2026, 4, 11, 3), 22, 7, utc)).toBe(true)
    })

    it('returns false at 07:00 (end hour, exclusive)', () => {
      expect(isWithinQuietHours(utcAt(2026, 4, 11, 7), 22, 7, utc)).toBe(false)
    })

    it('returns false at noon', () => {
      expect(isWithinQuietHours(utcAt(2026, 4, 11, 12), 22, 7, utc)).toBe(false)
    })
  })

  describe('timezone conversion', () => {
    it('uses the user timezone, not UTC, to compute the current hour', () => {
      // 06:00 UTC is 23:00 the previous day in America/Los_Angeles (UTC-7 during DST).
      // A 22→7 window in LA should include 23:00 LA time.
      const moment = utcAt(2026, 4, 11, 6)
      expect(isWithinQuietHours(moment, 22, 7, 'America/Los_Angeles')).toBe(true)
    })

    it('is tz-aware across date boundaries', () => {
      // 14:00 UTC = 07:00 LA. A 22→7 overnight window is inclusive of [22,0)∪[0,7),
      // and 07:00 itself is the exclusive end, so LA 07:00 should be OUTSIDE the window.
      const moment = utcAt(2026, 4, 11, 14)
      expect(isWithinQuietHours(moment, 22, 7, 'America/Los_Angeles')).toBe(false)
    })

    it('handles a positive-offset tz (Asia/Tokyo, UTC+9)', () => {
      // 00:00 UTC = 09:00 Tokyo; a 9→17 window should match.
      const moment = utcAt(2026, 4, 11, 0)
      expect(isWithinQuietHours(moment, 9, 17, 'Asia/Tokyo')).toBe(true)
    })
  })
})
