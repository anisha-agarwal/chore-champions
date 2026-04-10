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
  const childId = searchParams.get('childId')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50)
  const cursor = searchParams.get('cursor')

  let query = supabase
    .from('ai_kid_chats')
    .select('id, child_id, messages, created_at, profiles!ai_kid_chats_child_id_fkey(display_name)')
    .eq('family_id', profile.family_id)
    .order('created_at', { ascending: false })
    .limit(limit + 1)

  if (childId) {
    query = query.eq('child_id', childId)
  }

  if (cursor) {
    query = query.lt('created_at', cursor)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
  }

  const hasMore = (data ?? []).length > limit
  const items = (data ?? []).slice(0, limit)

  return NextResponse.json({
    data: items.map(c => {
      const childProfile = c.profiles as unknown as { display_name: string } | null
      return {
        id: c.id,
        childId: c.child_id,
        childName: childProfile?.display_name ?? 'Unknown',
        messageCount: Array.isArray(c.messages) ? c.messages.length : 0,
        createdAt: c.created_at,
      }
    }),
    nextCursor: hasMore ? items[items.length - 1].created_at : null,
  })
}

export const GET = withObservability(handler)
