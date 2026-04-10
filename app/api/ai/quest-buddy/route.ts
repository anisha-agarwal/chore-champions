import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withObservability } from '@/lib/observability/middleware-timing'
import { trackEvent } from '@/lib/observability/event-tracker'
import {
  buildKidSystemPrompt,
  KID_SESSION_MESSAGE_LIMIT,
  type KidContext,
} from '@/lib/ai/prompts'
import type { AiKidChat, ChatMessage } from '@/lib/types'

async function handler(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ data: null })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('family_id, role, display_name, points')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.family_id) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 400 })
  }

  let body: { message?: unknown; chatId?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const message = typeof body.message === 'string' ? body.message.trim() : null
  if (!message || message.length === 0 || message.length > 500) {
    return NextResponse.json({ error: 'Invalid message' }, { status: 400 })
  }
  const chatId = typeof body.chatId === 'string' ? body.chatId : undefined

  // Rate limit: dual cap (20/user + 50/family)
  const { data: rateResult } = await supabase.rpc('check_and_increment_ai_rate_limit', {
    p_family_id: profile.family_id,
    p_user_id: user.id,
  })
  const rate = rateResult as { allowed: boolean; reason: string | null } | null
  if (!rate?.allowed) {
    const msg = rate?.reason === 'user_limit'
      ? "You've reached your message limit for today (20). Try again tomorrow!"
      : "Your family has reached today's message limit (50). Try again tomorrow!"
    return NextResponse.json({ error: msg, reason: rate?.reason }, { status: 429 })
  }

  // Parent preview mode: stream without persisting a kid chat record
  const isParentPreview = profile.role === 'parent'

  // For kids: load or create chat session
  let chat: AiKidChat | null = null
  if (!isParentPreview) {
    if (chatId) {
      const { data } = await supabase
        .from('ai_kid_chats')
        .select('*')
        .eq('id', chatId)
        .single()
      if (!data) {
        return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
      }
      chat = data as AiKidChat

      // Enforce per-session message cap
      if ((chat.messages as ChatMessage[]).length >= KID_SESSION_MESSAGE_LIMIT) {
        return NextResponse.json(
          { error: 'Session limit reached. Start a new chat!', reason: 'session_limit' },
          { status: 429 }
        )
      }
    } else {
      const { data, error } = await supabase
        .from('ai_kid_chats')
        .insert({ child_id: user.id, family_id: profile.family_id, messages: [] })
        .select()
        .single()
      if (error || !data) {
        return NextResponse.json({ error: 'Failed to create chat' }, { status: 500 })
      }
      chat = data as AiKidChat
    }
  }

  // Build kid context for system prompt
  const kidContext = await buildKidContext(supabase, user.id, profile.family_id, profile)

  const systemPrompt = buildKidSystemPrompt(kidContext)

  const history = chat
    ? (chat.messages as ChatMessage[]).slice(-10) // shorter history for kids
    : []

  const newUserMessage: ChatMessage = {
    role: 'user',
    content: message,
    timestamp: new Date().toISOString(),
  }

  // Call Anthropic with streaming
  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'messages-2023-06-16',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256, // shorter responses for kids
      stream: true,
      system: systemPrompt,
      messages: [
        ...history.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: message },
      ],
    }),
    signal: AbortSignal.timeout(30000),
  })

  if (!anthropicRes.ok || !anthropicRes.body) {
    return NextResponse.json({ error: 'AI unavailable' }, { status: 503 })
  }

  const streamStartTime = Date.now()
  const encoder = new TextEncoder()
  const sourceReader = anthropicRes.body.getReader()
  let accumulatedText = ''
  let lineBuffer = ''

  const stream = new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await sourceReader.read()
          if (done) break
          controller.enqueue(value)

          // Parse for accumulation
          lineBuffer += new TextDecoder().decode(value, { stream: true })
          const lines = lineBuffer.split('\n')
          /* istanbul ignore next */
          lineBuffer = lines.pop() ?? ''
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            try {
              const parsed = JSON.parse(line.slice(6)) as Record<string, unknown>
              if (
                parsed['type'] === 'content_block_delta' &&
                (parsed['delta'] as Record<string, unknown>)?.['type'] === 'text_delta'
              ) {
                accumulatedText += (parsed['delta'] as Record<string, unknown>)['text'] as string
              }
            } catch {
              // Skip non-JSON lines
            }
          }
        }

        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: accumulatedText,
          timestamp: new Date().toISOString(),
        }

        let limitReached = false

        // Persist for real kid sessions (not parent previews)
        if (!isParentPreview && chat) {
          await supabase.rpc('append_kid_chat_messages', {
            p_id: chat.id,
            p_messages: JSON.stringify([newUserMessage, assistantMessage]),
          })

          const newCount = (chat.messages as ChatMessage[]).length + 2
          limitReached = newCount >= KID_SESSION_MESSAGE_LIMIT
        }

        trackEvent({
          event_type: 'ai_kid_chat_message',
          user_id: user.id,
          family_id: profile.family_id!,
          metadata: {
            streamDurationMs: Date.now() - streamStartTime,
            responseLength: accumulatedText.length,
          },
        })

        controller.enqueue(
          encoder.encode(
            `event: chat_meta\ndata: ${JSON.stringify({
              chatId: chat?.id ?? null,
              limitReached,
            })}\n\n`
          )
        )
        controller.close()
      } catch (err) {
        /* istanbul ignore next */
        controller.error(err)
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  }) as unknown as NextResponse
}

async function buildKidContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  familyId: string,
  profile: { display_name: string; points: number; role: string }
): Promise<KidContext> {
  const today = new Date().toISOString().split('T')[0]

  const [{ data: pendingTasks }, { data: recentCompletions }] = await Promise.all([
    supabase
      .from('tasks')
      .select('title, points')
      .eq('family_id', familyId)
      .eq('assigned_to', userId)
      .eq('completed', false)
      .limit(5),
    supabase
      .from('task_completions')
      .select('points_earned, completion_date')
      .eq('completed_by', userId)
      .gte('completion_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .lte('completion_date', today)
      .limit(10),
  ])

  return {
    childName: profile.display_name,
    points: profile.points,
    pendingTasks: (pendingTasks ?? []).map(t => ({ title: t.title, points: t.points })),
    recentCompletions: (recentCompletions ?? []).map(c => ({
      pointsEarned: c.points_earned,
      completionDate: c.completion_date ?? today,
    })),
  }
}

// Vercel Pro streaming timeout — read by Next.js/Vercel runtime
export const maxDuration = 60
export const POST = withObservability(handler)
