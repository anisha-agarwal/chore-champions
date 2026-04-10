import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withObservability } from '@/lib/observability/middleware-timing'

async function handler(
  _req: NextRequest,
  context: unknown
): Promise<NextResponse> {
  const { id } = await (context as { params: Promise<{ id: string }> }).params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'parent') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // RLS ensures parents can only access their own family's conversations
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ data })
}

export const GET = withObservability(handler)
