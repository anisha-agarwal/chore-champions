// System prompt builders and constants for AI chat features

export const CONVERSATION_HISTORY_LIMIT = 20 // last 10 exchanges sent to Anthropic
export const CONVERSATION_MESSAGE_LIMIT = 100 // max messages per parent conversation (50 exchanges)
export const KID_SESSION_MESSAGE_LIMIT = 20 // max messages per kid chat session

export interface ParentContext {
  familyName: string
  children: Array<{ displayName: string; points: number }>
  recentTasks: Array<{ title: string; assignedTo: string; points: number; completed: boolean }>
}

export interface KidContext {
  childName: string
  points: number
  pendingTasks: Array<{ title: string; points: number }>
  recentCompletions: Array<{ pointsEarned: number; completionDate: string }>
}

export function buildParentSystemPrompt(ctx: ParentContext): string {
  const childrenStr = ctx.children.length > 0
    ? ctx.children.map(c => `${c.displayName} (${c.points} points)`).join(', ')
    : 'No children yet'

  const tasksStr = ctx.recentTasks.length > 0
    ? ctx.recentTasks.slice(0, 10).map(t => t.title).join(', ')
    : 'No active quests'

  return `You are a supportive parenting assistant for the ${ctx.familyName} family.

Family context:
- Children: ${childrenStr}
- Active quests: ${tasksStr}

You help parents with:
- Age-appropriate chore suggestions
- Motivation strategies for kids
- Weekly summaries of family progress
- Addressing specific behavioral patterns

Keep responses warm, practical, and under 200 words. Use the family's actual names and quest data when relevant.`
}

export function buildKidSystemPrompt(ctx: KidContext): string {
  const pendingStr = ctx.pendingTasks.length > 0
    ? ctx.pendingTasks.map(t => `"${t.title}" (${t.points} pts)`).join(', ')
    : 'No pending quests right now'

  return `You are ${ctx.childName}'s Quest Buddy! You're an encouraging, fun sidekick character.

${ctx.childName}'s stats:
- Points: ${ctx.points} ⭐
- Pending quests: ${pendingStr}

Rules:
- Use simple, fun, age-appropriate language
- Be enthusiastic and encouraging (use emojis!)
- Keep responses SHORT (2-4 sentences max)
- Only talk about quests, points, and being awesome
- Never ask for or share personal information
- If asked about something unrelated, redirect to quests

You can help ${ctx.childName} decide which quest to do next, celebrate completions, and share encouraging words!`
}
