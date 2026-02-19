import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { snapToNearest, matchAssignee, VALID_POINTS } from '@/lib/parse-quest'
import type { ParseQuestResponse } from '@/lib/parse-quest'

export async function POST(request: Request) {
  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ prefill: null } satisfies ParseQuestResponse)
  }

  let body: { input?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ prefill: null } satisfies ParseQuestResponse)
  }

  if (!body.input || typeof body.input !== 'string' || !body.input.trim()) {
    return NextResponse.json({ prefill: null } satisfies ParseQuestResponse)
  }

  // Fetch family members for assignee matching
  const { data: profile } = await supabase
    .from('profiles')
    .select('family_id')
    .eq('id', user.id)
    .single()

  const familyId = profile?.family_id
  let members: { id: string; display_name: string; nickname: string | null }[] = []

  if (familyId) {
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, nickname')
      .eq('family_id', familyId)

    members = data || []
  }

  const memberNames = members.map(m => m.nickname || m.display_name).join(', ')

  const systemPrompt =
    'You extract structured quest data from natural language descriptions. ' +
    'A quest is a chore or task assigned to a family member. ' +
    'Extract as many fields as you can from the input. Use reasonable defaults for missing fields.'

  const userPrompt =
    `Parse this quest description: "${body.input.trim()}"\n\n` +
    (memberNames ? `Family members: ${memberNames}` : 'No family members available.')

  // 5-second timeout
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

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
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        tools: [
          {
            name: 'extract_quest',
            description: 'Extract structured quest data from a natural language description.',
            input_schema: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  description: 'Short title for the quest (e.g., "Make bed")',
                },
                description: {
                  type: 'string',
                  description: 'Optional longer description of the quest',
                },
                points: {
                  type: 'number',
                  description: 'Point value for completing the quest (typically 5-50)',
                },
                time_of_day: {
                  type: 'string',
                  enum: ['morning', 'afternoon', 'night', 'anytime'],
                  description: 'When during the day the quest should be done',
                },
                recurring: {
                  type: 'string',
                  enum: ['daily', 'weekly'],
                  description: 'How often the quest repeats, if mentioned',
                },
                assigned_to: {
                  type: 'string',
                  description: 'Name of the family member this quest is for, if mentioned',
                },
              },
              required: ['title'],
            },
          },
        ],
        tool_choice: { type: 'tool', name: 'extract_quest' },
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      return NextResponse.json({ prefill: null } satisfies ParseQuestResponse)
    }

    const data = await response.json()
    const toolBlock = data?.content?.find(
      (b: { type: string }) => b.type === 'tool_use'
    )

    if (!toolBlock?.input) {
      return NextResponse.json({ prefill: null } satisfies ParseQuestResponse)
    }

    const input = toolBlock.input as {
      title?: string
      description?: string
      points?: number
      time_of_day?: string
      recurring?: string
      assigned_to?: string
    }

    const prefill: ParseQuestResponse['prefill'] = {
      title: input.title || '',
      description: input.description || '',
      points: snapToNearest(input.points || 10, VALID_POINTS),
      time_of_day: input.time_of_day || 'anytime',
      recurring: input.recurring || null,
      assigned_to: matchAssignee(input.assigned_to, members),
    }

    return NextResponse.json({ prefill } satisfies ParseQuestResponse)
  } catch {
    clearTimeout(timeout)
    return NextResponse.json({ prefill: null } satisfies ParseQuestResponse)
  }
}
