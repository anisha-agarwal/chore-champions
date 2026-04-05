import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withObservability } from '@/lib/observability/middleware-timing'

async function handler(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('family_id, role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'parent') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50)
  const cursor = searchParams.get('cursor') // ISO timestamp for cursor-based pagination

  let query = supabase
    .from('ai_conversations')
    .select('id, title, updated_at, messages')
    .eq('family_id', profile.family_id)
    .order('updated_at', { ascending: false })
    .limit(limit + 1) // fetch one extra to determine if there's a next page

  if (cursor) {
    query = query.lt('updated_at', cursor)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 })
  }

  const hasMore = (data ?? []).length > limit
  const items = (data ?? []).slice(0, limit)

  return NextResponse.json({
    data: items.map(c => ({
      id: c.id,
      title: c.title,
      updatedAt: c.updated_at,
      messageCount: Array.isArray(c.messages) ? c.messages.length : 0,
    })),
    nextCursor: hasMore ? items[items.length - 1].updated_at : null,
  })
}

export const GET = withObservability(handler)
