import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withObservability } from '@/lib/observability/middleware-timing'
import { trackEvent } from '@/lib/observability/event-tracker'
import {
  buildParentSystemPrompt,
  CONVERSATION_HISTORY_LIMIT,
  CONVERSATION_MESSAGE_LIMIT,
  type ParentContext,
} from '@/lib/ai/prompts'
import type { AiConversation, ChatMessage } from '@/lib/types'

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
    .select('family_id, role, display_name')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'parent') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!profile.family_id) {
    return NextResponse.json({ error: 'No family' }, { status: 400 })
  }

  let body: { message?: unknown; conversationId?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const message = typeof body.message === 'string' ? body.message.trim() : null
  if (!message || message.length === 0 || message.length > 2000) {
    return NextResponse.json({ error: 'Invalid message' }, { status: 400 })
  }
  const conversationId = typeof body.conversationId === 'string' ? body.conversationId : undefined

  // Rate limit: dual cap (20/user + 50/family)
  const { data: rateResult } = await supabase.rpc('check_and_increment_ai_rate_limit', {
    p_family_id: profile.family_id,
    p_user_id: user.id,
  })
  const rate = rateResult as { allowed: boolean; reason: string | null } | null
  if (!rate?.allowed) {
    const msg = rate?.reason === 'user_limit'
      ? "You've reached your personal message limit for today (20). Try again tomorrow!"
      : "Your family has reached today's message limit (50). Try again tomorrow!"
    return NextResponse.json({ error: msg, reason: rate?.reason }, { status: 429 })
  }

  // Load or create conversation (server is authoritative for history)
  let conversation: AiConversation
  if (conversationId) {
    const { data } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('id', conversationId)
      .single()
    if (!data) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }
    conversation = data as AiConversation
  } else {
    const { data, error } = await supabase
      .from('ai_conversations')
      .insert({ family_id: profile.family_id, parent_id: user.id, messages: [] })
      .select()
      .single()
    if (error || !data) {
      return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
    }
    conversation = data as AiConversation
    trackEvent({
      event_type: 'ai_chat_conversation_created',
      user_id: user.id,
      family_id: profile.family_id,
      metadata: { conversationId: conversation.id },
    })
  }

  // Truncate history to last N messages before sending to Anthropic
  const history = (conversation.messages as ChatMessage[]).slice(-CONVERSATION_HISTORY_LIMIT)
  const newUserMessage: ChatMessage = {
    role: 'user',
    content: message,
    timestamp: new Date().toISOString(),
  }

  // Build family context for system prompt
  const familyContext = await buildParentContext(supabase, profile.family_id)
  const { data: familyData } = await supabase
    .from('families')
    .select('name')
    .eq('id', profile.family_id)
    .single()
  const familyName = familyData?.name ?? 'your family'

  const systemPrompt = buildParentSystemPrompt({ familyName, ...familyContext })

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
      max_tokens: 512,
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
          // Forward chunk to client immediately
          controller.enqueue(value)

          // Also parse for accumulation (line-buffered SSE)
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
              // Skip non-JSON lines (SSE comments, ping frames)
            }
          }
        }

        // Stream complete — persist both messages atomically
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: accumulatedText,
          timestamp: new Date().toISOString(),
        }

        const currentCount = (conversation.messages as ChatMessage[]).length
        const limitReached = currentCount >= CONVERSATION_MESSAGE_LIMIT

        if (!limitReached) {
          await supabase.rpc('append_chat_messages', {
            p_id: conversation.id,
            p_messages: JSON.stringify([newUserMessage, assistantMessage]),
          })
        }

        // Auto-title on the first message pair
        let title = conversation.title
        if (!title && conversation.messages.length === 0) {
          title = message.slice(0, 60) + (message.length > 60 ? '...' : '')
          await supabase
            .from('ai_conversations')
            .update({ title })
            .eq('id', conversation.id)
        }

        trackEvent({
          event_type: 'ai_parent_chat_message',
          user_id: user.id,
          family_id: profile.family_id!,
          metadata: {
            conversationId: conversation.id,
            streamDurationMs: Date.now() - streamStartTime,
            responseLength: accumulatedText.length,
          },
        })

        // Send metadata event so client learns the conversationId and title
        controller.enqueue(
          encoder.encode(
            `event: conversation_meta\ndata: ${JSON.stringify({
              conversationId: conversation.id,
              title,
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

  // Cast: NextResponse extends Response; withObservability reads only .status
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  }) as unknown as NextResponse
}

async function buildParentContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  familyId: string
): Promise<Omit<ParentContext, 'familyName'>> {
  const [{ data: children }, { data: tasks }] = await Promise.all([
    supabase
      .from('profiles')
      .select('display_name, points')
      .eq('family_id', familyId)
      .eq('role', 'child'),
    supabase
      .from('tasks')
      .select('title, assigned_to, points, completed')
      .eq('family_id', familyId)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  return {
    children: (children ?? []).map(c => ({
      displayName: c.display_name,
      points: c.points,
    })),
    recentTasks: (tasks ?? []).map(t => ({
      title: t.title,
      assignedTo: t.assigned_to ?? '',
      points: t.points,
      completed: t.completed ?? false,
    })),
  }
}

// Vercel Pro streaming timeout — read by Next.js/Vercel runtime
export const maxDuration = 60
export const POST = withObservability(handler)
