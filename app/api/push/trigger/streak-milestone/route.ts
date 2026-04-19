import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withObservability } from '@/lib/observability/middleware-timing'
import { sendPushToUser } from '@/lib/push/send'

async function handler(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { days?: number; badge?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (typeof body.days !== 'number' || body.days < 1) {
    return NextResponse.json({ error: 'days is required and must be a positive number' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('family_id, display_name')
    .eq('id', user.id)
    .single()

  if (!profile?.family_id) {
    return NextResponse.json({ error: 'User has no family' }, { status: 403 })
  }

  const badgeLabel = body.badge ?? `${body.days}-day streak`
  const payload = {
    type: 'streak_milestone' as const,
    title: `${badgeLabel}!`,
    body: `${profile.display_name} hit a ${body.days}-day streak`,
    url: '/me?tab=streaks',
  }

  // Send to the child who earned it
  const childSent = await sendPushToUser(user.id, payload)

  // Send to parents in the family
  const { data: parents } = await supabase
    .from('profiles')
    .select('id')
    .eq('family_id', profile.family_id)
    .eq('role', 'parent')

  let parentSent = 0
  if (parents && parents.length > 0) {
    const results = await Promise.allSettled(
      parents.map((p: { id: string }) => sendPushToUser(p.id, payload)),
    )
    parentSent = results
      .filter((r) => r.status === 'fulfilled' && (r as PromiseFulfilledResult<number>).value > 0)
      .length
  }

  return NextResponse.json({ childSent, parentSent })
}

export const POST = withObservability(handler)
