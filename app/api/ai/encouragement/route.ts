import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { EncouragementContext } from '@/lib/encouragement'

export async function POST(request: Request) {
  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ message: null })
  }

  let context: EncouragementContext
  try {
    context = await request.json()
  } catch {
    return NextResponse.json({ message: null })
  }

  const systemPrompt =
    'You generate short, fun, age-appropriate encouragement messages for kids completing chores. ' +
    'Keep messages under 30 words. Vary your style: sometimes use exclamations, sometimes questions, ' +
    'sometimes puns or wordplay. Never be sarcastic or condescending. Be genuinely enthusiastic.'

  const milestoneNote = context.isMilestone
    ? ` This is a milestone: ${context.milestoneType}!`
    : ''

  const overdueNote = context.isOverdue
    ? ' The task was completed late, but still encourage them for finishing it.'
    : ''

  const userPrompt =
    `${context.userName} just completed "${context.taskTitle}" and earned ${context.pointsEarned} points. ` +
    `They now have ${context.totalPoints} total points. ` +
    `They've done ${context.completionsToday} of ${context.totalTasksToday} tasks today. ` +
    `It's currently ${context.timeOfDay}.${milestoneNote}${overdueNote}`

  // 2-second timeout
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 2000)

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 100,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      return NextResponse.json({ message: null })
    }

    const data = await response.json()
    const message = data?.content?.[0]?.text?.trim() || null

    return NextResponse.json({
      message,
      isMilestone: context.isMilestone,
    })
  } catch {
    clearTimeout(timeout)
    return NextResponse.json({ message: null })
  }
}
