import { snapToNearest, matchAssignee, VALID_POINTS } from '@/lib/parse-quest'

describe('snapToNearest', () => {
  it('returns exact match', () => {
    expect(snapToNearest(10, VALID_POINTS)).toBe(10)
  })

  it('rounds down to nearest option', () => {
    expect(snapToNearest(7, VALID_POINTS)).toBe(5)
  })

  it('rounds up to nearest option', () => {
    expect(snapToNearest(8, VALID_POINTS)).toBe(10)
  })

  it('clamps to max when value exceeds all options', () => {
    expect(snapToNearest(100, VALID_POINTS)).toBe(50)
  })

  it('clamps to min when value is below all options', () => {
    expect(snapToNearest(1, VALID_POINTS)).toBe(5)
  })

  it('returns value when options array is empty', () => {
    expect(snapToNearest(7, [])).toBe(7)
  })

  it('handles tie by picking first encountered', () => {
    // 12.5 is equidistant from 10 and 15, picks 10 (first encountered)
    expect(snapToNearest(12, VALID_POINTS)).toBe(10)
  })

  it('returns single option when only one exists', () => {
    expect(snapToNearest(99, [25])).toBe(25)
  })

  it('handles zero value', () => {
    expect(snapToNearest(0, VALID_POINTS)).toBe(5)
  })

  it('handles negative value', () => {
    expect(snapToNearest(-5, VALID_POINTS)).toBe(5)
  })
})

describe('matchAssignee', () => {
  const members = [
    { id: 'user-1', display_name: 'Sarah', nickname: 'Sar' },
    { id: 'user-2', display_name: 'Timothy', nickname: 'Timmy' },
    { id: 'user-3', display_name: 'Alex', nickname: null },
  ]

  it('returns null for null name', () => {
    expect(matchAssignee(null, members)).toBeNull()
  })

  it('returns null for undefined name', () => {
    expect(matchAssignee(undefined, members)).toBeNull()
  })

  it('returns null for empty string name', () => {
    expect(matchAssignee('', members)).toBeNull()
  })

  it('returns null for empty member list', () => {
    expect(matchAssignee('Sarah', [])).toBeNull()
  })

  it('matches exact display_name (case-insensitive)', () => {
    expect(matchAssignee('sarah', members)).toBe('user-1')
  })

  it('matches exact display_name (exact case)', () => {
    expect(matchAssignee('Sarah', members)).toBe('user-1')
  })

  it('matches exact nickname (case-insensitive)', () => {
    expect(matchAssignee('timmy', members)).toBe('user-2')
  })

  it('matches exact nickname (exact case)', () => {
    expect(matchAssignee('Sar', members)).toBe('user-1')
  })

  it('matches by prefix of display_name', () => {
    expect(matchAssignee('Tim', members)).toBe('user-2')
  })

  it('matches by prefix of nickname', () => {
    expect(matchAssignee('Ti', members)).toBe('user-2')
  })

  it('matches by prefix of nickname when display_name does not match', () => {
    const membersWithUniqueNick = [
      { id: 'user-x', display_name: 'Robert', nickname: 'Bob' },
    ]
    expect(matchAssignee('Bo', membersWithUniqueNick)).toBe('user-x')
  })

  it('matches by substring of display_name', () => {
    expect(matchAssignee('imoth', members)).toBe('user-2')
  })

  it('matches by substring of nickname', () => {
    expect(matchAssignee('imm', members)).toBe('user-2')
  })

  it('returns null when no match found', () => {
    expect(matchAssignee('Bob', members)).toBeNull()
  })

  it('prefers exact match over prefix match', () => {
    const membersWithOverlap = [
      { id: 'user-a', display_name: 'Al', nickname: null },
      { id: 'user-b', display_name: 'Alex', nickname: null },
    ]
    expect(matchAssignee('Al', membersWithOverlap)).toBe('user-a')
  })

  it('prefers prefix match over substring match', () => {
    const membersForTest = [
      { id: 'user-a', display_name: 'Xander', nickname: null },
      { id: 'user-b', display_name: 'Alexander', nickname: null },
    ]
    // "Xan" is prefix of "Xander" and substring of "Alexander"
    expect(matchAssignee('Xan', membersForTest)).toBe('user-a')
  })

  it('handles member with null nickname in all tiers', () => {
    expect(matchAssignee('Alex', members)).toBe('user-3')
    expect(matchAssignee('Al', members)).toBe('user-3')
    expect(matchAssignee('lex', members)).toBe('user-3')
  })
})

describe('VALID_POINTS', () => {
  it('contains expected point values', () => {
    expect([...VALID_POINTS]).toEqual([5, 10, 15, 20, 25, 50])
  })
})
