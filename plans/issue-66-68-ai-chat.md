# Final Plan: AI Chat Features — Parenting Assistant (#66) & Quest Buddy (#68)

## Executive Summary

Chore Champions needs two conversational AI chat interfaces: a **Parenting Assistant** for parents (context-aware family advice) and a **Quest Buddy** for kids (encouraging sidekick). This plan adds streaming SSE chat via the existing raw-fetch Anthropic API pattern, persists conversations in two new Supabase tables with RLS isolation, and shares a themeable `ChatPanel` client component between both features. The key architectural insight is **server-authoritative history**: the client sends only the new message and a conversation ID — the server loads history from the DB, streams the response while accumulating it server-side, and persists both messages atomically after the stream completes.

---

## Problem Analysis

### Functional Requirements

1. **Parent chat with AI** — multi-turn conversation with persistent history, context-aware (family data, children, quests)
2. **Kid chat with AI** — short, encouraging exchanges with quest/points context, age-appropriate safety guardrails
3. **Streaming responses** — token-by-token display via SSE (new for this codebase)
4. **Conversation persistence** — survives page reloads, resumable
5. **Conversation listing** — parents see their chats + kids' chat history
6. **Quick action buttons** — pre-configured prompts for common queries
7. **Rate limiting** — 50 messages/day per family, 20/user sub-cap, 20 messages/kid session

### Non-Functional Requirements

- **Latency**: First token within 1.5s (Haiku model is fast)
- **Safety**: Kid chat stays on-topic via system prompt; no PII; parent can review history
- **Cost**: Haiku model + max_tokens cap + rate limits keep costs under control
- **Mobile-first**: Full-page chat views (no slide-out panels)
- **Accessibility**: Semantic HTML, keyboard accessible, `role="log"` on message area
- **Reliability**: No lost messages on normal usage; graceful degradation on AI unavailability
- **100% unit test coverage** on all new code

### Constraints

- Raw `fetch()` to Anthropic API — no `@anthropic-ai/sdk` (existing pattern)
- Model: `claude-haiku-4-5-20251001` (fixed)
- Next.js 16 App Router, React 19, TypeScript strict, Supabase, Tailwind CSS v4
- Server Components by default; `'use client'` only when needed
- Sequential migration naming (next is `016_`)
- RLS on all new tables
- `withObservability()` on all new API routes

### Priority Ordering

1. **Correctness** — messages must persist reliably, history must be server-authoritative
2. **Safety** — kid guardrails, RLS isolation, rate limiting
3. **UX** — streaming feels responsive, quick actions reduce friction
4. **Simplicity** — minimal new patterns, reuse existing codebase conventions

---

## Design Comparison

### 1. Message Persistence Strategy

**Design A** (refined): Client-side save. API route pipes SSE directly to client. After client's reader loop completes, client makes a separate POST to `/api/ai/conversations/save` to persist both messages.

**Design B** (refined): Server-side persistence via `ReadableStream` with async `start()`. Server reads from Anthropic, enqueues chunks to client, accumulates text, and persists after the streaming loop completes but before `controller.close()`.

**Selected: Design B's server-side persistence.** The `ReadableStream` async `start()` pattern is the standard Next.js App Router way to handle streaming. The function stays alive until `controller.close()` is called, so persistence code runs reliably. Design A's client-side save introduces an extra endpoint, an extra round-trip, and loses messages if the user closes the tab before the save fires. Both approaches lose messages if the client disconnects mid-stream, but B has the partial accumulated text available for potential recovery.

### 2. Rate Limiting

**Design A** (refined): Dual-cap — 50/family/day AND 20/user/day via a `check_and_increment_ai_rate_limit` Postgres function with rollback on block.

**Design B** (refined): Family-only cap — 50/family/day via a simple `ai_daily_usage` table with atomic upsert.

**Selected: Merged approach.** Use Design B's simpler `ai_daily_usage` table structure but add Design A's per-user sub-cap. The dual-cap prevents one family member from monopolizing the daily budget. Use a single Postgres function that checks both caps atomically.

### 3. Concurrent JSONB Writes

**Design A** (refined): Optimistic concurrency with `expectedMessageCount` — client tracks message count, save route returns 409 on conflict.

**Design B** (refined): Atomic append via `append_chat_messages` Postgres RPC — `messages || p_messages` serializes at the row lock.

**Selected: Design B's atomic append RPC.** It's simpler, requires no client-side conflict handling, and PostgreSQL row-level locking ensures no lost messages. The optimistic concurrency approach adds complexity (409 handling, re-sync logic) for a scenario that's extremely rare in a family app.

### 4. History Sent to Anthropic

**Design A**: No truncation specified.

**Design B** (refined): Truncate to last 20 messages before sending to Anthropic.

**Selected: Design B's truncation.** Essential for cost control and staying within context window limits. 20 messages (10 exchanges) provides sufficient conversational context.

### 5. Kid RLS Policies

**Design A**: Separate SELECT/INSERT/UPDATE policies (no DELETE) — correctly restricts kids from deleting chat history.

**Design B** (refined): Same approach — explicit policies without DELETE.

**Selected: Both agree.** Separate policies without DELETE, enforcing append-only at the RLS layer.

### 6. SSE Client-Side Parsing

**Design A** (refined): Dedicated `consumeSseStream()` utility in `lib/ai/stream-helpers.ts` with proper line buffering, `AbortController` support, and clean interface.

**Design B** (refined): Inline line buffering in the `ChatPanel` component.

**Selected: Design A's `consumeSseStream()` utility.** Extracting this into a testable utility function is cleaner, more testable, and follows the project's code quality standards. The function returns a Promise<string> with the full accumulated text, making the ChatPanel code straightforward.

### 7. Conversation List API

**Design A**: Single `GET /api/ai/conversations` endpoint with LIMIT 20.

**Design B** (refined): Cursor-based pagination + separate `GET /api/ai/chat/conversations/[id]` endpoint for loading a single conversation.

**Selected: Design B's cursor pagination + single-conversation endpoint.** Without pagination, conversations older than 20 are inaccessible. The single-conversation endpoint keeps data access through the API layer rather than direct Supabase client calls.

### 8. Parent Preview of Quest Buddy

**Design A**: Not addressed.

**Design B** (refined): Parent preview mode — returns AI response without creating a `ai_kid_chats` row.

**Selected: Design B's preview mode.** Prevents orphaned kid chat records when parents test the quest buddy.

### 9. Per-Conversation Message Cap

**Design A** (refined): 50 messages via save route slice.

**Design B** (refined): 100 messages with metadata event when limit reached.

**Selected: Design B's approach with 100-message cap.** 50 exchanges (100 messages) is reasonable for a parent conversation that may span multiple sessions. The metadata event notifies the client cleanly.

### 10. `withObservability()` Compatibility

**Design A**: Not analyzed.

**Design B** (refined): Analyzed — middleware measures TTFB (setup time), not stream duration. Add manual `trackEvent()` at stream completion for full observability.

**Selected: Design B's analysis.** Keep `withObservability()` on streaming routes (measures setup time) and add a manual `trackEvent()` inside the `ReadableStream.start()` after persistence for stream duration metrics.

---

## Synthesized Architecture

### Component Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  PAGES (Server Components)                                           │
│  ┌───────────────────────┐   ┌───────────────────────────┐          │
│  │ /chat (parent)        │   │ /quest-buddy (kid)        │          │
│  │  → fetches convos     │   │  → renders welcome state  │          │
│  │  → renders ChatPanel  │   │  → renders ChatPanel      │          │
│  └───────────┬───────────┘   └────────────┬──────────────┘          │
│              │                            │                          │
│              ▼                            ▼                          │
│  ┌──────────────────────────────────────────────────────────┐       │
│  │  ChatPanel ('use client')                                 │       │
│  │  ┌───────────┐ ┌──────────────┐ ┌─────────────────────┐  │       │
│  │  │ChatHeader │ │MessageList   │ │ChatInput            │  │       │
│  │  │           │ │ └ChatMessage │ │ └QuickActions        │  │       │
│  │  │           │ │ └TypingDots  │ │                      │  │       │
│  │  └───────────┘ └──────────────┘ └─────────────────────┘  │       │
│  └──────────────────────┬───────────────────────────────────┘       │
│                         │ fetch() with ReadableStream                │
│                         ▼                                            │
│  ┌──────────────────────────────────────────────────────────┐       │
│  │  API ROUTES (streaming SSE)                               │       │
│  │  POST /api/ai/chat              (parent chat)             │       │
│  │  POST /api/ai/quest-buddy       (kid chat)                │       │
│  │  GET  /api/ai/chat/conversations (list + paginate)        │       │
│  │  GET  /api/ai/chat/conversations/[id] (single convo)      │       │
│  │  GET  /api/ai/quest-buddy/history (parent views kid chats)│       │
│  └──────────────────────┬───────────────────────────────────┘       │
│                         │                                            │
│     ┌───────────────────┼───────────────────┐                       │
│     ▼                   ▼                   ▼                       │
│  ┌──────────┐  ┌─────────────────┐  ┌────────────────────┐         │
│  │ Supabase │  │ Anthropic API   │  │ Observability      │         │
│  │ (DB+Auth)│  │ (raw fetch SSE) │  │ (withObs+trackEvt) │         │
│  └──────────┘  └─────────────────┘  └────────────────────┘         │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Model

#### Migration: `supabase/migrations/016_add_ai_chat_tables.sql`

```sql
-- ============================================================
-- Parent assistant conversations
-- ============================================================
CREATE TABLE ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_conversations_family_updated
  ON ai_conversations (family_id, updated_at DESC);
CREATE INDEX idx_ai_conversations_parent
  ON ai_conversations (parent_id);

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parents_select_conversations" ON ai_conversations
  FOR SELECT USING (
    family_id IN (SELECT family_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'parent')
  );

CREATE POLICY "parents_insert_conversations" ON ai_conversations
  FOR INSERT WITH CHECK (
    parent_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'parent')
  );

CREATE POLICY "parents_update_conversations" ON ai_conversations
  FOR UPDATE USING (parent_id = auth.uid());

-- ============================================================
-- Kid chat conversations
-- ============================================================
CREATE TABLE ai_kid_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_kid_chats_child_created
  ON ai_kid_chats (child_id, created_at DESC);
CREATE INDEX idx_ai_kid_chats_family_created
  ON ai_kid_chats (family_id, created_at DESC);

ALTER TABLE ai_kid_chats ENABLE ROW LEVEL SECURITY;

-- Kids: SELECT, INSERT, UPDATE only — NO DELETE (append-only)
CREATE POLICY "kids_select_own_chats" ON ai_kid_chats
  FOR SELECT USING (child_id = auth.uid());

CREATE POLICY "kids_insert_own_chats" ON ai_kid_chats
  FOR INSERT WITH CHECK (child_id = auth.uid());

CREATE POLICY "kids_update_own_chats" ON ai_kid_chats
  FOR UPDATE USING (child_id = auth.uid());

-- Parents can view their family's kid chats (read-only)
CREATE POLICY "parents_view_kid_chats" ON ai_kid_chats
  FOR SELECT USING (
    family_id IN (SELECT family_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'parent')
  );

-- ============================================================
-- Rate limiting — dual cap (per-family + per-user)
-- ============================================================
CREATE TABLE ai_daily_usage (
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  message_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (family_id, user_id, usage_date)
);

CREATE INDEX idx_ai_daily_usage_family_date
  ON ai_daily_usage (family_id, usage_date);

ALTER TABLE ai_daily_usage ENABLE ROW LEVEL SECURITY;

-- Parents can view family usage (for potential UI display)
CREATE POLICY "parents_view_usage" ON ai_daily_usage
  FOR SELECT USING (
    family_id IN (SELECT family_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'parent')
  );

-- ============================================================
-- Helper functions (SECURITY DEFINER — called by API routes)
-- ============================================================

-- Atomic rate limit check + increment with dual caps
CREATE OR REPLACE FUNCTION check_and_increment_ai_rate_limit(
  p_family_id UUID,
  p_user_id UUID,
  p_family_limit INT DEFAULT 50,
  p_user_limit INT DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_count INT;
  v_family_count INT;
BEGIN
  -- Upsert per-user row and increment
  INSERT INTO ai_daily_usage (family_id, user_id, usage_date, message_count)
  VALUES (p_family_id, p_user_id, CURRENT_DATE, 1)
  ON CONFLICT (family_id, user_id, usage_date)
  DO UPDATE SET message_count = ai_daily_usage.message_count + 1
  RETURNING message_count INTO v_user_count;

  -- Check per-user cap
  IF v_user_count > p_user_limit THEN
    UPDATE ai_daily_usage
    SET message_count = message_count - 1
    WHERE family_id = p_family_id AND user_id = p_user_id AND usage_date = CURRENT_DATE;
    RETURN jsonb_build_object('allowed', false, 'reason', 'user_limit');
  END IF;

  -- Check family total
  SELECT COALESCE(SUM(message_count), 0) INTO v_family_count
  FROM ai_daily_usage
  WHERE family_id = p_family_id AND usage_date = CURRENT_DATE;

  IF v_family_count > p_family_limit THEN
    UPDATE ai_daily_usage
    SET message_count = message_count - 1
    WHERE family_id = p_family_id AND user_id = p_user_id AND usage_date = CURRENT_DATE;
    RETURN jsonb_build_object('allowed', false, 'reason', 'family_limit');
  END IF;

  RETURN jsonb_build_object('allowed', true, 'reason', null);
END;
$$;

-- Atomic append messages to parent conversation
CREATE OR REPLACE FUNCTION append_chat_messages(p_id UUID, p_messages JSONB)
RETURNS void AS $$
  UPDATE ai_conversations
  SET messages = messages || p_messages,
      updated_at = now()
  WHERE id = p_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Atomic append messages to kid chat
CREATE OR REPLACE FUNCTION append_kid_chat_messages(p_id UUID, p_messages JSONB)
RETURNS void AS $$
  UPDATE ai_kid_chats
  SET messages = messages || p_messages
  WHERE id = p_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_ai_conversations_updated_at
  BEFORE UPDATE ON ai_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### TypeScript Types (`lib/types.ts` additions)

```typescript
export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  timestamp: string  // ISO 8601
}

export type AiConversation = {
  id: string
  family_id: string
  parent_id: string
  messages: ChatMessage[]
  title: string | null
  created_at: string
  updated_at: string
}

export type AiKidChat = {
  id: string
  child_id: string
  family_id: string
  messages: ChatMessage[]
  created_at: string
}

export type QuickAction = {
  label: string
  prompt: string
}
```

### API Specifications

#### `POST /api/ai/chat` — Parent Chat (Streaming)

**Auth:** Required. `role = 'parent'` enforced.

**Request:**
```typescript
{ conversationId?: string; message: string }
```

**Response:** SSE stream (`Content-Type: text/event-stream`). Anthropic's native SSE events piped through, plus a final custom event:
```
event: conversation_meta
data: {"conversationId": "uuid", "title": "First message truncated...", "limitReached": false}
```

**Server flow:**
1. Auth → profile → role check (parent)
2. Input validation: `message` is string, 1–2000 chars
3. Rate limit: `supabase.rpc('check_and_increment_ai_rate_limit', { p_family_id, p_user_id })`
4. Load or create conversation from DB (server-authoritative history)
5. Truncate history to last 20 messages
6. Build parent system prompt with family context
7. `fetch()` to Anthropic with `stream: true`
8. Return `ReadableStream` that:
   - Enqueues each chunk to client immediately
   - Accumulates assistant text via line-buffered SSE parser
   - After stream ends: persists via `append_chat_messages` RPC, auto-titles, sends `conversation_meta` event, fires `trackEvent()`
   - Calls `controller.close()`

**Errors:** 401 (not authenticated), 403 (not parent), 400 (invalid message), 429 (rate limited with `reason` field), 503 (AI unavailable)

#### `POST /api/ai/quest-buddy` — Kid Chat (Streaming)

**Auth:** Required. Any role (kids primary; parents can preview).

**Request:**
```typescript
{ chatId?: string; message: string }
```

**Response:** SSE stream, same format. Final event:
```
event: chat_meta
data: {"chatId": "uuid", "limitReached": false}
```

**Differences from parent route:**
- No role restriction (parents can preview)
- If `profile.role === 'parent'`: preview mode — stream response but do NOT create/persist a `ai_kid_chats` row
- `max_tokens: 256` (shorter responses for kids)
- Kid system prompt with safety guardrails
- Per-session cap: 20 messages (checked via `messages.length` on the chat record)
- Stores to `ai_kid_chats` table via `append_kid_chat_messages` RPC

#### `GET /api/ai/chat/conversations` — List Parent Conversations

**Auth:** Required, parent role.

**Query params:** `?limit=20&cursor=<ISO timestamp>`

**Response:**
```typescript
{
  data: Array<{
    id: string
    title: string | null
    updatedAt: string
    messageCount: number
  }>
  nextCursor: string | null
}
```

#### `GET /api/ai/chat/conversations/[id]` — Load Single Conversation

**Auth:** Required, parent role, family-scoped via RLS.

**Response:**
```typescript
{
  data: AiConversation
}
```

#### `GET /api/ai/quest-buddy/history` — Parent Views Kid Chat History

**Auth:** Required, parent role.

**Query params:** `?childId=uuid` (optional filter), `?limit=20&cursor=<ISO>`

**Response:**
```typescript
{
  data: Array<{
    id: string
    childId: string
    childName: string
    messageCount: number
    createdAt: string
  }>
  nextCursor: string | null
}
```

### Streaming Implementation

#### Server-Side: `ReadableStream` with Accumulation

```typescript
// app/api/ai/chat/route.ts
export const maxDuration = 60  // Vercel Pro streaming timeout

async function handler(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ data: null })

  const { data: profile } = await supabase
    .from('profiles').select('family_id, role, display_name').eq('id', user.id).single()
  if (!profile || profile.role !== 'parent') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Validate input
  const body = await req.json()
  const message = typeof body.message === 'string' ? body.message.trim() : null
  if (!message || message.length === 0 || message.length > 2000) {
    return NextResponse.json({ error: 'Invalid message' }, { status: 400 })
  }
  const { conversationId } = body as { conversationId?: string }

  // Rate limit (dual cap: 20/user, 50/family)
  const { data: rateResult } = await supabase.rpc('check_and_increment_ai_rate_limit', {
    p_family_id: profile.family_id,
    p_user_id: user.id,
  })
  if (!rateResult?.allowed) {
    const msg = rateResult?.reason === 'user_limit'
      ? "You've reached your personal message limit for today (20). Try again tomorrow!"
      : "Your family has reached today's message limit (50). Try again tomorrow!"
    return NextResponse.json({ error: msg, reason: rateResult?.reason }, { status: 429 })
  }

  // Load or create conversation (server is authoritative for history)
  let conversation: AiConversation
  if (conversationId) {
    const { data } = await supabase.from('ai_conversations')
      .select('*').eq('id', conversationId).single()
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    conversation = data
  } else {
    const { data } = await supabase.from('ai_conversations')
      .insert({ family_id: profile.family_id, parent_id: user.id, messages: [] })
      .select().single()
    conversation = data!
    trackEvent({ event_type: 'ai_chat_conversation_created', user_id: user.id,
      family_id: profile.family_id, metadata: { conversationId: conversation.id } })
  }

  // Truncate history to last 20 messages for Anthropic
  const history = (conversation.messages as ChatMessage[]).slice(-CONVERSATION_HISTORY_LIMIT)
  const newUserMessage: ChatMessage = {
    role: 'user', content: message, timestamp: new Date().toISOString()
  }

  // Build context + system prompt
  const familyContext = await buildParentContext(supabase, profile)
  const systemPrompt = buildParentSystemPrompt(familyContext)

  // Call Anthropic with streaming
  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
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

  // Stream response to client while accumulating server-side
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

          // Buffered SSE parsing for accumulation
          lineBuffer += new TextDecoder().decode(value, { stream: true })
          const lines = lineBuffer.split('\n')
          lineBuffer = lines.pop() ?? ''
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            try {
              const parsed = JSON.parse(line.slice(6))
              if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
                accumulatedText += parsed.delta.text
              }
            } catch { /* skip non-JSON lines */ }
          }
        }

        // Stream complete — persist messages
        const assistantMessage: ChatMessage = {
          role: 'assistant', content: accumulatedText, timestamp: new Date().toISOString()
        }

        const currentCount = (conversation.messages as ChatMessage[]).length
        const limitReached = currentCount >= CONVERSATION_MESSAGE_LIMIT

        if (!limitReached) {
          await supabase.rpc('append_chat_messages', {
            p_id: conversation.id,
            p_messages: JSON.stringify([newUserMessage, assistantMessage]),
          })
        }

        // Auto-title on first message
        let title = conversation.title
        if (!title && conversation.messages.length === 0) {
          title = message.slice(0, 60) + (message.length > 60 ? '...' : '')
          await supabase.from('ai_conversations').update({ title }).eq('id', conversation.id)
        }

        // Track event with stream duration
        trackEvent({
          event_type: 'ai_parent_chat_message',
          user_id: user.id,
          family_id: profile.family_id,
          metadata: {
            conversationId: conversation.id,
            streamDurationMs: Date.now() - streamStartTime,
            responseLength: accumulatedText.length,
          },
        })

        // Send metadata event so client learns the conversationId
        controller.enqueue(encoder.encode(
          `event: conversation_meta\ndata: ${JSON.stringify({
            conversationId: conversation.id, title, limitReached
          })}\n\n`
        ))
        controller.close()
      } catch (err) {
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
  })
}

export const POST = withObservability(handler)
```

#### Client-Side: `consumeSseStream` Utility

```typescript
// lib/ai/stream-helpers.ts

/**
 * Consumes an Anthropic SSE stream with proper line buffering.
 * Calls onToken with accumulated text after each text_delta.
 * Returns the full assistant message text when stream ends.
 */
export async function consumeSseStream(
  body: ReadableStream<Uint8Array>,
  onToken: (accumulated: string) => void,
  onMeta?: (meta: Record<string, unknown>) => void,
  signal?: AbortSignal
): Promise<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullContent = ''
  let nextEventType = ''

  try {
    while (true) {
      if (signal?.aborted) break
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          nextEventType = line.slice(7).trim()
          continue
        }
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (!data) continue

        try {
          const parsed = JSON.parse(data)

          // Handle custom metadata events
          if (nextEventType === 'conversation_meta' || nextEventType === 'chat_meta') {
            onMeta?.(parsed)
            nextEventType = ''
            continue
          }
          nextEventType = ''

          // Handle Anthropic streaming text deltas
          if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
            fullContent += parsed.delta.text
            onToken(fullContent)
          }
        } catch { /* skip malformed lines */ }
      }
    }
  } finally {
    reader.releaseLock()
  }

  return fullContent
}
```

### System Prompts

```typescript
// lib/ai/prompts.ts

export const CONVERSATION_HISTORY_LIMIT = 20  // last 10 exchanges
export const CONVERSATION_MESSAGE_LIMIT = 100  // max per conversation (50 exchanges)

interface ParentContext {
  familyName: string
  children: Array<{ displayName: string; points: number }>
  recentTasks: Array<{ title: string; assignedTo: string; points: number; completed: boolean }>
}

interface KidContext {
  childName: string
  points: number
  pendingTasks: Array<{ title: string; points: number }>
  recentCompletions: Array<{ pointsEarned: number; completionDate: string }>
}

export function buildParentSystemPrompt(ctx: ParentContext): string {
  return `You are a supportive parenting assistant for the ${ctx.familyName} family.

Family context:
- Children: ${ctx.children.map(c => `${c.displayName} (${c.points} points)`).join(', ')}
- Active quests: ${ctx.recentTasks.slice(0, 10).map(t => t.title).join(', ')}

You help parents with:
- Age-appropriate chore suggestions
- Motivation strategies for kids
- Weekly summaries of family progress
- Addressing specific behavioral patterns

Keep responses warm, practical, and under 200 words. Use the family's actual names and quest data when relevant.`
}

export function buildKidSystemPrompt(ctx: KidContext): string {
  return `You are ${ctx.childName}'s Quest Buddy! You're an encouraging, fun sidekick character.

${ctx.childName}'s stats:
- Points: ${ctx.points} ⭐
- Pending quests: ${ctx.pendingTasks.map(t => `"${t.title}" (${t.points} pts)`).join(', ')}

Rules:
- Use simple, fun, age-appropriate language
- Be enthusiastic and encouraging (use emojis!)
- Keep responses SHORT (2-4 sentences max)
- Only talk about quests, points, and being awesome
- Never ask for or share personal information
- If asked about something unrelated, redirect to quests

You can help ${ctx.childName} decide which quest to do next, celebrate completions, and share encouraging words!`
}
```

### Shared Chat UI Component

```typescript
// components/chat/chat-panel.tsx ('use client')

interface ChatPanelProps {
  apiEndpoint: '/api/ai/chat' | '/api/ai/quest-buddy'
  systemName: string              // 'Parenting Assistant' | 'Quest Buddy'
  theme: 'parent' | 'kid'
  quickActions: QuickAction[]
  maxMessages?: number            // kid: 20 per session
  conversationId?: string         // resume existing conversation
  initialMessages?: ChatMessage[]
  onConversationCreated?: (id: string) => void
}
```

**State:**
- `messages: ChatMessage[]` — conversation history
- `streamingContent: string` — accumulates tokens during streaming
- `isStreaming: boolean` — disables input, shows typing indicator
- `error: string | null` — user-friendly error display
- `conversationId: string | null` — set from metadata event

**Send message flow:**
1. Set `isStreaming(true)`, add user message to `messages` optimistically
2. `fetch(apiEndpoint, { method: 'POST', body: { message, conversationId }, signal })`
3. If non-ok: handle error (429 → rate limit message, 503 → retry message, remove optimistic message)
4. Call `consumeSseStream(res.body, onToken, onMeta, signal)`
5. `onToken` updates `streamingContent` — shown as growing assistant bubble
6. `onMeta` captures `conversationId`, `title`, `limitReached`
7. On completion: add assistant message to `messages`, clear `streamingContent`, set `isStreaming(false)`

**Theming:**
- Parent: `bg-purple-600` header, `bg-purple-100` assistant bubbles
- Kid: `bg-gradient-to-r from-yellow-400 to-pink-500` header, `bg-green-100` assistant bubbles

**Quick Actions:**
```typescript
// Page files define the arrays
const PARENT_QUICK_ACTIONS: QuickAction[] = [
  { label: '💡 Suggest quests', prompt: 'Suggest 3 age-appropriate chores for my kids based on their current quests.' },
  { label: '📊 Weekly report', prompt: "Give me a summary of my family's quest progress this week." },
  { label: '🌟 Motivation tips', prompt: 'My kids seem unmotivated lately. What are some strategies to re-engage them?' },
  { label: '🎯 Points balance', prompt: 'How are my kids doing with their points? Any patterns I should know about?' },
]

const KID_QUICK_ACTIONS: QuickAction[] = [
  { label: '🚀 What should I do?', prompt: 'Which quest should I do next?' },
  { label: '⭐ My points', prompt: 'How many points do I have? What can I get?' },
  { label: '🎉 I finished one!', prompt: 'I just finished a quest! Celebrate with me!' },
  { label: '💪 I need help', prompt: "I'm stuck on a quest. Can you help me?" },
]
```

### Error Handling Strategy

| Error | Server Response | Client UX |
|-------|----------------|-----------|
| Not authenticated | 401 | Redirect to login |
| Wrong role | 403 | Toast: "You don't have access to this feature" |
| Invalid message | 400 | Inline validation error below input |
| Rate limited (user) | 429 `{reason: "user_limit"}` | Toast: "You've reached your personal limit (20 messages/day)" |
| Rate limited (family) | 429 `{reason: "family_limit"}` | Toast: "Your family has reached today's limit (50 messages)" |
| No API key | 200 `{data: null}` | Fallback: "AI chat is not configured" |
| Anthropic error | 503 | Toast: "Chat is temporarily unavailable" + retry button |
| Stream interrupted | Partial SSE | Show partial text + "(response interrupted)" indicator |
| Kid session limit (20) | `limitReached: true` in metadata | Input disabled: "That's all for now! Start a new chat anytime 🌟" |
| Conversation full (100) | `limitReached: true` in metadata | Toast: "Start a new conversation to continue" |

### Observability Integration

Add to `lib/observability/constants.ts`:
```typescript
// In APP_EVENT_TYPES array:
'ai_parent_chat_message',
'ai_kid_chat_message',
'ai_chat_conversation_created',
```

Both streaming routes:
- Wrapped with `withObservability()` (measures setup time / TTFB)
- Manual `trackEvent()` inside `ReadableStream.start()` after persistence (measures stream duration, response length)

---

## Key Design Decisions

### 1. Server-Side Persistence via ReadableStream
- **Decision**: Server accumulates the assistant response while streaming and persists after stream ends, before `controller.close()`
- **Source**: Design B
- **Rationale**: Single request handles everything — no extra endpoint or round-trip. Function stays alive while stream is active. Messages are persisted even if client navigates away immediately after stream ends.
- **Alternative**: Design A's client-side save (separate POST after stream). Rejected because it introduces an extra endpoint, extra latency, and loses messages if user closes tab before save fires.

### 2. Server-Authoritative History
- **Decision**: Client sends `{ message, conversationId? }` — server loads history from DB
- **Source**: Both designs converged on this after critique
- **Rationale**: Prevents client injection of fake assistant messages, eliminates multi-tab divergence, makes the server the source of truth
- **Alternative**: Client sends full `messages[]` array. Rejected as a security risk (prompt injection via fabricated history).

### 3. Dual-Cap Rate Limiting
- **Decision**: 50 messages/family/day AND 20 messages/user/day, checked atomically via Postgres function
- **Source**: Design A's per-user sub-cap merged with Design B's table structure
- **Rationale**: Prevents one family member from monopolizing the budget. Atomic function with rollback-on-block ensures family quota isn't consumed by blocked requests.
- **Alternative**: Family-only cap (Design B). Rejected because one active child could lock out parents.

### 4. Atomic Append via Postgres RPC
- **Decision**: `append_chat_messages` RPC using `messages || p_messages`
- **Source**: Design B
- **Rationale**: Serializes at the row lock — no lost messages under concurrency. Simpler than optimistic concurrency (no 409 handling needed).
- **Alternative**: Design A's `expectedMessageCount` optimistic concurrency. Rejected as over-engineered for a family app where concurrent writes to the same conversation are extremely rare.

### 5. Separate Tables (Not Polymorphic)
- **Decision**: `ai_conversations` for parents, `ai_kid_chats` for kids
- **Source**: Both designs agreed
- **Rationale**: Clear RLS policies, simple queries, type-safe. Different columns (`parent_id` vs `child_id`, `updated_at` presence). Some route code duplication is acceptable.
- **Alternative**: Single polymorphic `ai_chats` table with `role` column. Rejected because RLS policies become complex and error-prone.

### 6. Full-Page Chat (Not Slide-Out)
- **Decision**: `/chat` and `/quest-buddy` are full-page views
- **Source**: Both designs agreed
- **Rationale**: Mobile-first — full-page is simpler and more reliable. Browser back button handles navigation. No complex overlay state management.
- **Alternative**: Slide-out panel on desktop. Rejected for v1 — adds complexity without proportional benefit.

---

## How This Improves Current Architecture

### Weakness: No AI Conversation Support
- **How addressed**: Two new streaming chat routes with persistent conversation history
- **Remaining risk**: None — this is the core feature

### Weakness: No Streaming in the Codebase
- **How addressed**: Establishes the SSE streaming pattern via `ReadableStream` with line-buffered parsing. Creates reusable `consumeSseStream()` client utility. Both patterns are documented and tested.
- **Remaining risk**: Vercel Hobby plan has 10s timeout (must be on Pro for streaming). `maxDuration = 60` is set.

### Weakness: No Rate Limiting on AI Routes
- **How addressed**: Atomic dual-cap rate limiter (per-user + per-family) via Postgres function. Applies to both chat endpoints.
- **Remaining risk**: Existing AI routes (encouragement, parse-quest, analytics-insights) still have no rate limiting. Consider applying the same pattern to them in a follow-up.

### Weakness: No Kid-Facing AI Features
- **How addressed**: Quest Buddy with age-appropriate system prompt, short response cap (256 tokens), per-session message limit (20), no DELETE RLS policy, parent oversight via chat history viewing
- **Remaining risk**: System prompt guardrails can be jailbroken. Acceptable for v1 — parent review provides a transparency layer. Evaluate Claude's built-in safety features for v2.

---

## Implementation Strategy

### Phase 1: Database & Shared Infrastructure

**Files to create:**
- `supabase/migrations/016_add_ai_chat_tables.sql` — tables, RLS policies, indexes, helper functions, trigger
- `lib/ai/prompts.ts` — `buildParentSystemPrompt()`, `buildKidSystemPrompt()`, constants
- `lib/ai/stream-helpers.ts` — `consumeSseStream()` client utility
- `lib/ai/rate-limit.ts` — rate limit types (thin wrapper — actual logic is in Postgres function)

**Files to modify:**
- `lib/types.ts` — add `ChatMessage`, `AiConversation`, `AiKidChat`, `QuickAction` types
- `lib/observability/constants.ts` — add new event types

**Run migration via Supabase Management API before proceeding.**

### Phase 2: API Routes

**Files to create:**
- `app/api/ai/chat/route.ts` — parent chat streaming endpoint
- `app/api/ai/quest-buddy/route.ts` — kid chat streaming endpoint
- `app/api/ai/chat/conversations/route.ts` — GET conversation list (cursor-paginated)
- `app/api/ai/chat/conversations/[id]/route.ts` — GET single conversation
- `app/api/ai/quest-buddy/history/route.ts` — GET kid chat history (parent view)

**Dependencies:** Phase 1

### Phase 3: Chat UI Components

**Files to create:**
- `components/chat/chat-panel.tsx` — shared chat UI (`'use client'`)
- `components/chat/chat-message.tsx` — message bubble (user vs assistant)
- `components/chat/typing-indicator.tsx` — animated bouncing dots
- `components/chat/quick-actions.tsx` — horizontal scrollable action chips
- `components/chat/conversation-list.tsx` — list of past conversations with loading skeleton

**Dependencies:** Phase 2 (API routes for integration testing)

### Phase 4: Pages & Navigation

**Files to create:**
- `app/(dashboard)/chat/page.tsx` — parent chat page (server component, fetches initial conversations, renders ChatPanel)
- `app/(dashboard)/quest-buddy/page.tsx` — kid quest buddy page (server component, renders ChatPanel with welcome state)

**Files to modify:**
- `components/layout/nav-bar.tsx` — add chat icon button (conditional on `role === 'parent'`)
- `app/(dashboard)/quests/page.tsx` — add Quest Buddy FAB for kids

**Dependencies:** Phase 3

### Phase 5: Testing

**Files to create:**
- `__tests__/chat-panel.test.tsx` — ChatPanel unit tests (renders, streaming state, quick actions, error handling)
- `__tests__/chat-message.test.tsx` — message bubble rendering tests
- `__tests__/typing-indicator.test.tsx` — typing indicator tests
- `__tests__/quick-actions.test.tsx` — quick action chip tests
- `__tests__/api/ai/chat.test.ts` — parent chat route tests (auth, role, rate limit, streaming)
- `__tests__/api/ai/quest-buddy.test.ts` — kid chat route tests (auth, context, streaming, preview mode)
- `__tests__/lib/ai/prompts.test.ts` — system prompt builder tests
- `__tests__/lib/ai/stream-helpers.test.ts` — `consumeSseStream` tests (buffering, abort, error)
- `__tests__/db/ai-conversations.test.ts` — RLS: parents create/read, children blocked, cross-family blocked
- `__tests__/db/ai-kid-chats.test.ts` — RLS: kids see own, parents see family's, no DELETE, cross-family blocked
- `e2e/chat.spec.ts` — parent chat E2E: open, send message, streaming response, persistence
- `e2e/quest-buddy.spec.ts` — kid chat E2E: open, quick action, streaming, session limit

**Files to modify:**
- `playwright.config.ts` — add `chat\.spec\.ts` and `quest-buddy\.spec\.ts` to `testMatch` patterns

**Dependencies:** Phase 4 (full feature for E2E), but unit tests can start during Phase 2-3.

### Ordering Constraints

```
Phase 1 (DB + shared) → Phase 2 (API) → Phase 3 (UI) → Phase 4 (pages) → Phase 5 (tests)
                                          ↑ unit tests can start here
```

### Rollback Strategy

- **Migration rollback**: `DROP TABLE ai_daily_usage; DROP TABLE ai_kid_chats; DROP TABLE ai_conversations; DROP FUNCTION check_and_increment_ai_rate_limit; DROP FUNCTION append_chat_messages; DROP FUNCTION append_kid_chat_messages;` via Management API
- **Code rollback**: Revert the feature branch. No existing files have breaking changes (only additive modifications to nav-bar, quests page, types, constants).
- **Feature flag** (optional): If needed, wrap the nav-bar chat icon and quest buddy FAB behind `process.env.NEXT_PUBLIC_AI_CHAT_ENABLED` — quick disable without code revert.

---

## Risk Mitigation

### Top Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Vercel serverless timeout kills stream | Medium (if on Hobby plan) | High — responses cut off | `export const maxDuration = 60` on both routes. Must be on Vercel Pro. |
| Kid safety jailbreak via prompt injection | Medium | Medium — inappropriate content | System prompt guardrails + 256 token cap + parent review of chat history. Evaluate content filtering in v2. |
| JSONB row growth exceeds comfortable size | Low | Low — slow updates | 100-message per-conversation cap + 20-message history truncation to Anthropic. Max ~20KB per row. |
| `withObservability()` buffers response body | Low | High — breaks streaming | Inspect implementation during Phase 2. If it buffers, replace with manual try/catch + error tracking. |
| Concurrent writes to same conversation | Very low | Low — one message pair may be generated without seeing the other | Atomic append via RPC serializes writes. Both appends succeed; order is deterministic. |

### What to Monitor After Deployment

- `ai_parent_chat_message` and `ai_kid_chat_message` event counts — confirms features are being used
- `streamDurationMs` in event metadata — detect Anthropic latency regressions
- `ai_chat_conversation_created` count vs message count ratio — detect persistent conversations vs one-offs
- 429 response rate — detect if rate limits are too restrictive
- Error rates on streaming routes via `withObservability()` error tracking

### Reconsideration Decision Points

- If >10% of streams are cut off by timeout → investigate Vercel plan or reduce `max_tokens`
- If parents report kid safety issues → add post-stream content check or Anthropic moderation API
- If JSONB update latency exceeds 100ms → consider normalized message table (separate migration)
- If rate limits cause frequent user complaints → increase from 50/family to 100/family

---

## Success Metrics

### Leading Indicators (During Implementation)

- All RLS integration tests pass — confirms data isolation
- 100% unit test coverage on new code
- Streaming works end-to-end in dev (manual verification)
- E2E tests pass for both parent and kid chat flows

### Lagging Indicators (After Deployment)

- **Adoption**: >30% of active parents use the chat feature within 2 weeks
- **Engagement**: Average >3 messages per parent chat session
- **Kid engagement**: >50% of active kids interact with Quest Buddy within 2 weeks
- **Reliability**: <1% error rate on chat API routes
- **Cost**: Total Anthropic API cost stays under $5/month (Haiku + rate limits)
- **Safety**: Zero parent-reported inappropriate Quest Buddy responses in first month
