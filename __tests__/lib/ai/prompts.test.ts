import {
  buildParentSystemPrompt,
  buildKidSystemPrompt,
  CONVERSATION_HISTORY_LIMIT,
  CONVERSATION_MESSAGE_LIMIT,
  KID_SESSION_MESSAGE_LIMIT,
  type ParentContext,
  type KidContext,
} from '@/lib/ai/prompts'

describe('buildParentSystemPrompt', () => {
  const ctx: ParentContext = {
    familyName: 'Smith',
    children: [
      { displayName: 'Alice', points: 120 },
      { displayName: 'Bob', points: 45 },
    ],
    recentTasks: [
      { title: 'Wash dishes', assignedTo: 'alice-id', points: 10, completed: true },
      { title: 'Clean room', assignedTo: 'bob-id', points: 15, completed: false },
    ],
  }

  it('includes the family name', () => {
    const prompt = buildParentSystemPrompt(ctx)
    expect(prompt).toContain('Smith')
  })

  it('lists children with their points', () => {
    const prompt = buildParentSystemPrompt(ctx)
    expect(prompt).toContain('Alice (120 points)')
    expect(prompt).toContain('Bob (45 points)')
  })

  it('includes active quests', () => {
    const prompt = buildParentSystemPrompt(ctx)
    expect(prompt).toContain('Wash dishes')
    expect(prompt).toContain('Clean room')
  })

  it('handles empty children list', () => {
    const prompt = buildParentSystemPrompt({ ...ctx, children: [] })
    expect(prompt).toContain('No children yet')
  })

  it('handles empty tasks list', () => {
    const prompt = buildParentSystemPrompt({ ...ctx, recentTasks: [] })
    expect(prompt).toContain('No active quests')
  })

  it('limits tasks to 10 in the prompt', () => {
    const manyTasks = Array.from({ length: 15 }, (_, i) => ({
      title: `Task ${i}`,
      assignedTo: 'x',
      points: 5,
      completed: false,
    }))
    const prompt = buildParentSystemPrompt({ ...ctx, recentTasks: manyTasks })
    // Tasks 10-14 should not appear
    expect(prompt).not.toContain('Task 10')
    expect(prompt).toContain('Task 9')
  })
})

describe('buildKidSystemPrompt', () => {
  const ctx: KidContext = {
    childName: 'Alice',
    points: 120,
    pendingTasks: [
      { title: 'Sweep floor', points: 10 },
      { title: 'Feed dog', points: 5 },
    ],
    recentCompletions: [
      { pointsEarned: 10, completionDate: '2024-01-01' },
    ],
  }

  it('includes the child name', () => {
    const prompt = buildKidSystemPrompt(ctx)
    expect(prompt).toContain('Alice')
  })

  it('includes current points', () => {
    const prompt = buildKidSystemPrompt(ctx)
    expect(prompt).toContain('120')
  })

  it('lists pending tasks with points', () => {
    const prompt = buildKidSystemPrompt(ctx)
    expect(prompt).toContain('"Sweep floor" (10 pts)')
    expect(prompt).toContain('"Feed dog" (5 pts)')
  })

  it('handles empty pending tasks', () => {
    const prompt = buildKidSystemPrompt({ ...ctx, pendingTasks: [] })
    expect(prompt).toContain('No pending quests right now')
  })
})

describe('constants', () => {
  it('CONVERSATION_HISTORY_LIMIT is 20', () => {
    expect(CONVERSATION_HISTORY_LIMIT).toBe(20)
  })

  it('CONVERSATION_MESSAGE_LIMIT is 100', () => {
    expect(CONVERSATION_MESSAGE_LIMIT).toBe(100)
  })

  it('KID_SESSION_MESSAGE_LIMIT is 20', () => {
    expect(KID_SESSION_MESSAGE_LIMIT).toBe(20)
  })
})
